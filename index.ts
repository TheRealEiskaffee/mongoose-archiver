import mongoose, { Schema, Types } from 'mongoose';

export default function mongooseArchiver(schema : Schema) {
    const deleteMethods : TMethod[] = ['deleteOne', 'deleteMany', 'findOneAndDelete'],
          updateMethods : TMethod[] = ['findOneAndUpdate', 'updateMany', 'updateOne'],
          historySchema : Schema = new mongoose.Schema(schema.obj, { timestamps: false });

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

    updateMethods.forEach((method : TMethod) => {
        schema.pre(method, async function (next) {
            const modelName = this.model.modelName,
                  updateQuery = this.getUpdate(),
                  HistoryModel = mongoose.model(`${modelName}_history`, historySchema);

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
                        archivedBy:
                        updateQuery?.updatedBy ||
                        updateQuery?.$set?.updatedBy ||
                        updateQuery?.createdBy,
                    });

                    await historyDoc.save();
                }

                next();
            } catch (error) {
                next(error);
            }
        });
    });

    deleteMethods.forEach((method : TMethod) => {
        schema.pre(method, async function (next) {
            const modelName = this.model.modelName,
                  HistoryModel = mongoose.model(`${modelName}_history`, historySchema);

            try {
                const docToUpdate = (await this.model.findOne(this.getQuery())).toObject(),
                      version = await HistoryModel.countDocuments({ origin: new Types.ObjectId(docToUpdate._id) });

                if (docToUpdate) {
                    const historyDoc = new HistoryModel({
                        ...docToUpdate,
                        version,
                        archivedAt: new Date(),
                        archivedBy: docToUpdate?.updatedBy || docToUpdate?.createdBy,
                        deletedAt: new Date(),
                        deletedBy: docToUpdate?.updatedBy || docToUpdate?.createdBy,
                    });

                    await historyDoc.save();
                }

                next();
            } catch (error) {
                next(error);
            }
        });
    });
}

type TMethod = 'aggregate' | 'bulkWrite' | 'count' | 'countDocuments' | 'createCollection' | 'deleteOne' | 'deleteMany' | 'estimatedDocumentCount' | 'find' | 'findOne' | 'findOneAndDelete' | 'findOneAndReplace' | 'findOneAndUpdate' | 'init' | 'insertMany' | 'replaceOne' | 'save' | 'update' | 'updateOne' | 'updateMany' | 'validate';