"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskAsset = void 0;
const typeorm_1 = require("typeorm");
const task_entity_1 = require("./task.entity");
let TaskAsset = class TaskAsset {
};
exports.TaskAsset = TaskAsset;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'asset_id' }),
    __metadata("design:type", Number)
], TaskAsset.prototype, "assetId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'task_id' }),
    __metadata("design:type", Number)
], TaskAsset.prototype, "taskId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => task_entity_1.Task, (task) => task.assets, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'task_id' }),
    __metadata("design:type", task_entity_1.Task)
], TaskAsset.prototype, "task", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'asset_type', type: 'text' }),
    __metadata("design:type", String)
], TaskAsset.prototype, "assetType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'asset_path', type: 'text' }),
    __metadata("design:type", String)
], TaskAsset.prototype, "assetPath", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sort_order', default: 0 }),
    __metadata("design:type", Number)
], TaskAsset.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], TaskAsset.prototype, "meta", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], TaskAsset.prototype, "createdAt", void 0);
exports.TaskAsset = TaskAsset = __decorate([
    (0, typeorm_1.Entity)('task_assets')
], TaskAsset);
//# sourceMappingURL=task-asset.entity.js.map