import { Schema, SchemaType, Types } from 'mongoose';

export default function mongooseArchiver(schema : Schema, options : IOptions) {
    const deleteMethods : TMethod[] = ['deleteOne', 'deleteMany', 'findOneAndDelete'],
          updateMethods : TMethod[] = ['findOneAndUpdate', 'updateMany', 'updateOne'],
          historySchema : Schema = schema.clone();

    //Remove all required field,s in case that some data has added this flag after created objects
    for (const path in historySchema.paths) {
        if (historySchema.paths[path].isRequired) {
            historySchema.paths[path].required(false);
        }
    }

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
            const modelName = this.model.modelName,
                  updateQuery = this.getUpdate(),
                  HistoryModel = this.mongooseCollection.conn.model(`${modelName}_history`, historySchema);

            try {
                const docToUpdate = (await this.model.findOne(this.getQuery())).toObject(),
                      version = (await HistoryModel.countDocuments({ origin: new Types.ObjectId(docToUpdate._id) })) + 1;

                if (docToUpdate) {
                    const historyDoc = new HistoryModel({
                        ...docToUpdate,
                        _id: new Types.ObjectId(),
                        version,
                        origin: docToUpdate._id,
                        archivedAt: new Date(),
                        archivedBy: docToUpdate?.[options?.userField] || updateQuery?.updatedBy || updateQuery?.$set?.updatedBy || updateQuery?.createdBy,
                    });

                    await historyDoc.save();
                }

                next();
            } catch (error : any) {
                next(error);
            }
        });
    });

    deleteMethods.forEach((method : any) => {
        schema.pre(method, async function (next) {
            const modelName = this.model.modelName,
                  HistoryModel = this.mongooseCollection.conn.model(`${modelName}_history`, historySchema);

            try {
                const docToUpdate = (await this.model.findOne(this.getQuery())).toObject(),
                      version = await HistoryModel.countDocuments({ origin: new Types.ObjectId(docToUpdate._id) });

                if (docToUpdate) {
                    const historyDoc = new HistoryModel({
                        ...docToUpdate,
                        version,
                        archivedAt: new Date(),
                        archivedBy: docToUpdate?.[options?.userField] || docToUpdate?.updatedBy || docToUpdate?.createdBy,
                        deletedAt: new Date(),
                        deletedBy: docToUpdate?.[options?.userField] || docToUpdate?.updatedBy || docToUpdate?.createdBy,
                    });

                    await historyDoc.save();
                }

                next();
            } catch (error : any) {
                next(error);
            }
        });
    });
}

interface IOptions {
    userField ?: string
}

type TMethod = 'aggregate' | 'bulkWrite' | 'count' | 'countDocuments' | 'createCollection' | 'deleteOne' | 'deleteMany' | 'estimatedDocumentCount' | 'find' | 'findOne' | 'findOneAndDelete' | 'findOneAndReplace' | 'findOneAndUpdate' | 'init' | 'insertMany' | 'replaceOne' | 'save' | 'update' | 'updateOne' | 'updateMany' | 'validate';