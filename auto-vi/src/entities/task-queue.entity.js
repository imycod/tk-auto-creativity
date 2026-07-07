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
exports.TaskQueue = void 0;
const typeorm_1 = require("typeorm");
const task_entity_1 = require("./task.entity");
let TaskQueue = class TaskQueue {
};
exports.TaskQueue = TaskQueue;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'queue_id' }),
    __metadata("design:type", Number)
], TaskQueue.prototype, "queueId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'task_id' }),
    __metadata("design:type", Number)
], TaskQueue.prototype, "taskId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => task_entity_1.Task, (task) => task.queues, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'task_id' }),
    __metadata("design:type", task_entity_1.Task)
], TaskQueue.prototype, "task", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'text',
        default: 'init',
    }),
    __metadata("design:type", String)
], TaskQueue.prototype, "stage", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'text',
        default: 'pending',
    }),
    __metadata("design:type", String)
], TaskQueue.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'retry_count', default: 0 }),
    __metadata("design:type", Number)
], TaskQueue.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'worker_id', type: 'text', nullable: true }),
    __metadata("design:type", String)
], TaskQueue.prototype, "workerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", String)
], TaskQueue.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], TaskQueue.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], TaskQueue.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], TaskQueue.prototype, "createdAt", void 0);
exports.TaskQueue = TaskQueue = __decorate([
    (0, typeorm_1.Entity)('task_queue')
], TaskQueue);
//# sourceMappingURL=task-queue.entity.js.map