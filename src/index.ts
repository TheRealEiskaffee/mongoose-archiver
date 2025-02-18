import { Schema, Types } from 'mongoose';

export default function mongooseArchiver(schema : Schema, options : IOptions) {
    const deleteMethods : TMethod[] = ['deleteOne', 'deleteMany', 'findOneAndDelete'],
          updateMethods : TMethod[] = ['findOneAndUpdate', 'updateMany', 'updateOne'],
          clonedOriginSchema = schema.clone(),
          rawOriginSchemaObject = { ...clonedOriginSchema.obj },
          clonedIndexes = clonedOriginSchema
            .indexes()
            .map(([fields, options] : any) => {
                const newOptions = { ...options };
                delete newOptions.unique;
                return [fields, newOptions];
            }),
          newChildSchemas: { schema: Schema; model: string }[] = [];

    const recursiveUniqueRemoverFN = function (schema: any) {
        Object
            .keys(schema)
            .forEach(key => {
                if (schema[key]?.type instanceof Schema) {
                    recursiveUniqueRemoverFN(schema[key].type.obj);
                } else if (typeof schema?.[key] === 'object' && schema?.[key] !== null) {
                    if (schema?.[key]?.unique) delete schema[key].unique;

                    recursiveUniqueRemoverFN(schema[key]);
                }
            });
    };

    const processChildSchemaRecursively = (childSchema : any): { schema: Schema; model: string } => {
        const rawOriginChildSchemaObject = { ...childSchema.schema.obj };

        recursiveUniqueRemoverFN(rawOriginChildSchemaObject);

        const clonedChildIndexes = childSchema.schema
            .indexes()
            .map(([fields, options] : any) => {
                const newOptions = { ...options };
                delete newOptions.unique;
                return [fields, newOptions];
            });

        const newChildSchema = new Schema(rawOriginChildSchemaObject, { validateBeforeSave: false }).clearIndexes();

        clonedChildIndexes
            ?.forEach(([fields, options] : any) => {
                newChildSchema.index(fields, options);
            });

        const newNestedChildSchemas: { schema: Schema; model: string }[] = [];

        childSchema.schema.childSchemas
            ?.forEach((nestedChildSchema : any) => {
                const processedNestedChildSchema = processChildSchemaRecursively(nestedChildSchema);
                newNestedChildSchemas.push(processedNestedChildSchema);
            });

        newNestedChildSchemas
            ?.forEach(({ schema, model }) => {
                newChildSchema.add({ [model]: schema });
            });

        return {
            schema : newChildSchema,
            model : childSchema.model,
        };
    };
    
    schema.childSchemas
        ?.forEach(childSchema => {
            newChildSchemas.push(processChildSchemaRecursively(childSchema));
        });

    recursiveUniqueRemoverFN(rawOriginSchemaObject);

    const historySchema = new Schema(
        {
            ...rawOriginSchemaObject,
            origin: {
                type: Types.ObjectId,
            },
            version: {
                type: Number,
                default: 0,
                required: true,
            },
            archived: {
                at : {
                    type : Date,
                    default : () => new Date()
                },
                by: Types.ObjectId,
            },
            deleted: {
                at : Date,
                by: Types.ObjectId,
            },
        },
        {
            validateBeforeSave : false,
            strict : false,
        },
    ).clearIndexes();

    newChildSchemas
        .forEach(({ schema, model }) => {
            historySchema.add({ [model]: schema });
        });

    clonedIndexes
        .forEach(([fields, options]) => {
            historySchema.index(fields, options);
        });

    updateMethods
        .forEach((method : any) => {
            schema
                .pre(method, async function (next) {
                    const updateQuery = this.getUpdate(),
                          historyCollectionName = `${this.model?.collection?.collectionName || clonedOriginSchema?.get('collection')}${options?.separator || '-'}history`,
                          HistoryModel = this.mongooseCollection.conn.model(`${this.model.modelName}History`, historySchema, historyCollectionName);

                    try {
                        const docToUpdate = (await this.model.findOne(this.getQuery()))?.toObject();

                        if(docToUpdate) {
                            const version = (await HistoryModel.countDocuments({ origin: new Types.ObjectId(docToUpdate._id) })) + 1,
                                historyDoc = new HistoryModel({
                                    ...docToUpdate,
                                    _id: new Types.ObjectId(),
                                    version,
                                    origin: docToUpdate._id,
                                    archived : {
                                        at: new Date(),
                                        by: this?.options?.user || updateQuery?.[options?.userField] || docToUpdate?.[options?.userField] || updateQuery?.updatedBy || updateQuery?.$set?.updatedBy || updateQuery?.createdBy,
                                    }
                                });
                            
                            if(typeof options?.onUpdate === 'function') {
                                await options.onUpdate(historyDoc, updateQuery);
                            }

                            await historyDoc.save();
                        }

                        next();
                    } catch (error : any) {
                        next(error);
                    }
                });
        });

    deleteMethods
        .forEach((method : any) => {
            schema
                .pre(method, { document: true, query: false }, async function (next) {
                    const historyCollectionName = `${this.model?.collection?.collectionName || clonedOriginSchema?.get('collection')}${options?.separator || '-'}history`,
                          HistoryModel = this.mongooseCollection.conn.model(`${this.model.modelName}History`, historySchema, historyCollectionName);

                    try {
                        const docToUpdate = (await this.model.findOne(this.getQuery()))?.toObject();

                        if(docToUpdate) {
                            const version = await HistoryModel.countDocuments({ origin: new Types.ObjectId(docToUpdate._id) }),
                                historyDoc = new HistoryModel({
                                    ...docToUpdate,
                                    version,
                                    archived : {
                                        at : new Date(),
                                        by : this?.options?.user || docToUpdate?.[options?.userField] || docToUpdate?.updatedBy || docToUpdate?.createdBy,
                                    },
                                    deleted : {
                                        at : new Date(),
                                        by : this?.options?.user || docToUpdate?.[options?.userField] || docToUpdate?.updatedBy || docToUpdate?.createdBy,
                                    }
                                });
                                
                            if(typeof options?.onDelete === 'function') {
                                options.onDelete(historyDoc);
                            }

                            await historyDoc.save();
                        }

                        next();
                    } catch (error : any) {
                        next(error);
                    }
                });
        });
}

/**
 * Configuration options for managing history operations.
 */
interface IOptions {
    /**
     * Specifies the field used to identify the user responsible for changes, 
     * such as `updated_userId`. This acts as a fallback if no specific field is provided.
     */
    userField?: string;

    /**
     * Defines the separator used in constructing collection names.
     * For example, `myCollection-histories` uses `-` as the default separator.
     */
    separator?: string;

    /**
     * A callback function executed when a history document is created.
     * @param historyDocument - The document being created in the history collection.
     * @param updateQuery - The update query of the original document.
     * @returns A Promise (for async operations) or void.
     */
    onUpdate?: (historyDocument: any, updateQuery: any) => Promise<void> | void;

    /**
     * A callback function executed when a history document is deleted.
     * @param historyDocument - The document being deleted in the history collection.
     * @returns A Promise (for async operations) or void.
     */
    onDelete?: (historyDocument: any) => Promise<void> | void;
}

type TMethod = 'aggregate' | 'bulkWrite' | 'count' | 'countDocuments' | 'createCollection' | 'deleteOne' | 'deleteMany' | 'estimatedDocumentCount' | 'find' | 'findOne' | 'findOneAndDelete' | 'findOneAndReplace' | 'findOneAndUpdate' | 'init' | 'insertMany' | 'replaceOne' | 'save' | 'update' | 'updateOne' | 'updateMany' | 'validate';