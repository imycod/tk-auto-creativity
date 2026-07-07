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
exports.Video = void 0;
const typeorm_1 = require("typeorm");
const task_entity_1 = require("./task.entity");
let Video = class Video {
};
exports.Video = Video;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'video_id' }),
    __metadata("design:type", Number)
], Video.prototype, "videoId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'task_id', unique: true }),
    __metadata("design:type", Number)
], Video.prototype, "taskId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => task_entity_1.Task, (task) => task.video, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'task_id' }),
    __metadata("design:type", task_entity_1.Task)
], Video.prototype, "task", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_path', type: 'text' }),
    __metadata("design:type", String)
], Video.prototype, "filePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], Video.prototype, "duration", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Video.prototype, "resolution", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Video.prototype, "createdAt", void 0);
exports.Video = Video = __decorate([
    (0, typeorm_1.Entity)('videos')
], Video);
//# sourceMappingURL=video.entity.js.map