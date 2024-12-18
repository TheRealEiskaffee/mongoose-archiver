import { Schema, SchemaType, Types } from 'mongoose';

export default function mongooseArchiver(schema : Schema, options : IOptions) {
    const deleteMethods : TMethod[] = ['deleteOne', 'deleteMany', 'findOneAndDelete'],
          updateMethods : TMethod[] = ['findOneAndUpdate', 'updateMany', 'updateOne'],
          historySchema : Schema = schema.clone();
          
    //Remove all required field's in case that some data has added this flag after created objects
    function setRequiredFalse(usedSchema : Schema) {
        usedSchema
            ?.eachPath((path, schemaType : any) => {
                if (schemaType?.instance === 'Array' && schemaType?.casterConstructor?.schema) {
                    setRequiredFalse(schemaType.casterConstructor.schema);
                } else {
                    if (schemaType?.isRequired) {
                        schemaType.required(false);
                    }

                    if(schemaType?.schema) {
                        setRequiredFalse(schemaType.schema);
                    }
                }
            });
    }
  
    setRequiredFalse(historySchema);

    historySchema.add({
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
                                  by: updateQuery?.[options?.userField] || docToUpdate?.[options?.userField] || updateQuery?.updatedBy || updateQuery?.$set?.updatedBy || updateQuery?.createdBy,
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
                                  by : docToUpdate?.[options?.userField] || docToUpdate?.updatedBy || docToUpdate?.createdBy,
                              },
                              deleted : {
                                  at : new Date(),
                                  by : docToUpdate?.[options?.userField] || docToUpdate?.updatedBy || docToUpdate?.createdBy,
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

interface IOptions {
    userField ?: string,
    separator ?: string,
    onUpdate ?: (historyDocument: any) => Promise<void> | void;
    onDelete ?: (historyDocument: any) => Promise<void> | void;
}

type TMethod = 'aggregate' | 'bulkWrite' | 'count' | 'countDocuments' | 'createCollection' | 'deleteOne' | 'deleteMany' | 'estimatedDocumentCount' | 'find' | 'findOne' | 'findOneAndDelete' | 'findOneAndReplace' | 'findOneAndUpdate' | 'init' | 'insertMany' | 'replaceOne' | 'save' | 'update' | 'updateOne' | 'updateMany' | 'validate';