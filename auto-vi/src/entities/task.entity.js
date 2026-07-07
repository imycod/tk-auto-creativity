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
exports.Task = void 0;
const typeorm_1 = require("typeorm");
const task_queue_entity_1 = require("./task-queue.entity");
const task_asset_entity_1 = require("./task-asset.entity");
const video_entity_1 = require("./video.entity");
let Task = class Task {
};
exports.Task = Task;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'task_id' }),
    __metadata("design:type", Number)
], Task.prototype, "taskId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'prompt_text', type: 'text' }),
    __metadata("design:type", String)
], Task.prototype, "promptText", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'text',
        default: 'pending',
    }),
    __metadata("design:type", String)
], Task.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_id', type: 'text', nullable: true }),
    __metadata("design:type", String)
], Task.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'batch_date', type: 'date', nullable: true }),
    __metadata("design:type", String)
], Task.prototype, "batchDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Task.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', nullable: true }),
    __metadata("design:type", Date)
], Task.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => task_queue_entity_1.TaskQueue, (queue) => queue.task),
    __metadata("design:type", Array)
], Task.prototype, "queues", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => task_asset_entity_1.TaskAsset, (asset) => asset.task),
    __metadata("design:type", Array)
], Task.prototype, "assets", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => video_entity_1.Video, (video) => video.task),
    __metadata("design:type", video_entity_1.Video)
], Task.prototype, "video", void 0);
exports.Task = Task = __decorate([
    (0, typeorm_1.Entity)('tasks')
], Task);
//# sourceMappingURL=task.entity.js.map