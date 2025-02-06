import { Schema, Types } from 'mongoose';

function cleanSchema(schema : any) {
    if (typeof schema !== 'object' || schema === null) return schema;

    const cleaned : any = {};

    for (const key in schema) {
        if (typeof schema?.[key] === 'object' && schema?.[key] !== null) {
            cleaned[key] = cleanSchema(schema[key]);

            if ('unique' in cleaned[key]) {
                delete cleaned[key].unique;
            }

            if ('required' in cleaned[key]) {
                delete cleaned[key].required;
            }
        } else {
            cleaned[key] = schema[key];
        }
    }

    return cleaned;
}
export default function mongooseArchiver(schema : Schema, options : IOptions) {
    const deleteMethods : TMethod[] = ['deleteOne', 'deleteMany', 'findOneAndDelete'],
          updateMethods : TMethod[] = ['findOneAndUpdate', 'updateMany', 'updateOne'],
          historySchema = new Schema(cleanSchema(schema.clone().obj));

    historySchema.add({
        origin: {
            type: Types.ObjectId,
            index: true
        },
        version: {
            type: Number,
            default: 0,
            required: true,
        },
        archived: {
            at : {
                type : Date,
                default : () => new Date(),
                index: true
            },
            by: Types.ObjectId,
        },
        deleted: {
            at : {
                type : Date,
                index: true
            },
            by: Types.ObjectId,
        },
    });

    updateMethods.forEach((method : any) => {
        schema.pre(method, async function (next) {
            const updateQuery = this.getUpdate(),
                  historyCollectionName = `${this.model.collection.collectionName}${options?.separator || '-'}history`,
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
                    
                    await historyDoc.save();

                    if(typeof options?.onUpdate === 'function') {
                        options.onUpdate(historyDoc);
                    }
                }

                next();
            } catch (error : any) {
                next(error);
            }
        });
    });

    deleteMethods.forEach((method : any) => {
        schema.pre(method, async function (next) {
            const historyCollectionName = `${this.model.collection.collectionName}${options?.separator || '-'}history`,
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

                    await historyDoc.save();
                    
                    if(typeof options?.onDelete === 'function') {
                        options.onDelete(historyDoc);
                    }
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
     * such as `userId`. This acts as a fallback if no specific field is provided.
     */
    userField?: string;

    /**
     * Defines the separator used in constructing collection names.
     * For example, `myCollection-histories` uses `-` as the default separator.
     */
    separator?: string;

    /**
     * A callback function executed when a history document is updated.
     * @param historyDocument - The document being updated in the history collection.
     * @returns A Promise (for async operations) or void.
     */
    onUpdate?: (historyDocument: any) => Promise<void> | void;

    /**
     * A callback function executed when a history document is deleted.
     * @param historyDocument - The document being deleted in the history collection.
     * @returns A Promise (for async operations) or void.
     */
    onDelete?: (historyDocument: any) => Promise<void> | void;
}

type TMethod = 'aggregate' | 'bulkWrite' | 'count' | 'countDocuments' | 'createCollection' | 'deleteOne' | 'deleteMany' | 'estimatedDocumentCount' | 'find' | 'findOne' | 'findOneAndDelete' | 'findOneAndReplace' | 'findOneAndUpdate' | 'init' | 'insertMany' | 'replaceOne' | 'save' | 'update' | 'updateOne' | 'updateMany' | 'validate';