"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = mongooseArchiver;
const mongoose_1 = require("mongoose");
function mongooseArchiver(schema) {
    const deleteMethods = ['deleteOne', 'deleteMany', 'findOneAndDelete'], updateMethods = ['findOneAndUpdate', 'updateMany', 'updateOne'], historySchema = schema.clone();
    historySchema.add({
        origin: {
            type: mongoose_1.Types.ObjectId,
        },
        version: {
            type: Number,
            default: 0,
            required: true,
        },
        archived: {
            at: {
                type: Date,
                default: () => new Date()
            },
            by: mongoose_1.Types.ObjectId,
        },
        deleted: {
            at: Date,
            by: mongoose_1.Types.ObjectId,
        },
    });
    updateMethods.forEach((method) => {
        schema.pre(method, function (next) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a;
                const modelName = this.model.modelName, updateQuery = this.getUpdate(), HistoryModel = this.mongooseCollection.conn.model(`${modelName}_history`, historySchema);
                try {
                    const docToUpdate = (yield this.model.findOne(this.getQuery())).toObject(), version = (yield HistoryModel.countDocuments({ origin: new mongoose_1.Types.ObjectId(docToUpdate._id) })) + 1;
                    if (docToUpdate) {
                        const historyDoc = new HistoryModel(Object.assign(Object.assign({}, docToUpdate), { _id: new mongoose_1.Types.ObjectId(), version, origin: docToUpdate._id, archivedAt: new Date(), archivedBy: (updateQuery === null || updateQuery === void 0 ? void 0 : updateQuery.updatedBy) ||
                                ((_a = updateQuery === null || updateQuery === void 0 ? void 0 : updateQuery.$set) === null || _a === void 0 ? void 0 : _a.updatedBy) ||
                                (updateQuery === null || updateQuery === void 0 ? void 0 : updateQuery.createdBy) }));
                        yield historyDoc.save();
                    }
                    next();
                }
                catch (error) {
                    next(error);
                }
            });
        });
    });
    deleteMethods.forEach((method) => {
        schema.pre(method, function (next) {
            return __awaiter(this, void 0, void 0, function* () {
                const modelName = this.model.modelName, HistoryModel = this.mongooseCollection.conn.model(`${modelName}_history`, historySchema);
                try {
                    const docToUpdate = (yield this.model.findOne(this.getQuery())).toObject(), version = yield HistoryModel.countDocuments({ origin: new mongoose_1.Types.ObjectId(docToUpdate._id) });
                    if (docToUpdate) {
                        const historyDoc = new HistoryModel(Object.assign(Object.assign({}, docToUpdate), { version, archivedAt: new Date(), archivedBy: (docToUpdate === null || docToUpdate === void 0 ? void 0 : docToUpdate.updatedBy) || (docToUpdate === null || docToUpdate === void 0 ? void 0 : docToUpdate.createdBy), deletedAt: new Date(), deletedBy: (docToUpdate === null || docToUpdate === void 0 ? void 0 : docToUpdate.updatedBy) || (docToUpdate === null || docToUpdate === void 0 ? void 0 : docToUpdate.createdBy) }));
                        yield historyDoc.save();
                    }
                    next();
                }
                catch (error) {
                    next(error);
                }
            });
        });
    });
}
