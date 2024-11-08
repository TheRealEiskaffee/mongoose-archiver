const { Types } = require("mongoose");

/**
 * Mongoose Archiver Plugin
 * Dieses Plugin erstellt automatisch eine "History"-Sammlung, um Änderungen und Löschvorgänge zu protokollieren.
 * @param {Schema} schema - Mongoose-Schema
 */
function mongooseArchiver(schema) {
    const deleteMethods = ['deleteOne', 'deleteMany', 'findOneAndDelete'],
          updateMethods = ['findOneAndUpdate', 'updateMany', 'updateOne'],
          historySchema = schema.clone();
          
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

    updateMethods.forEach((method) => {
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

    deleteMethods.forEach((method) => {
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

// Exportiere das Plugin
module.exports = mongooseArchiver;