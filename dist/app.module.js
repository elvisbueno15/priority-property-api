"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const events_module_1 = require("./events/events.module");
const activity_module_1 = require("./activity/activity.module");
const time_tracking_module_1 = require("./time-tracking/time-tracking.module");
const chat_module_1 = require("./chat/chat.module");
const meetings_module_1 = require("./meetings/meetings.module");
const feedback_module_1 = require("./feedback/feedback.module");
const app_controller_1 = require("./app.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [events_module_1.EventsModule, users_module_1.UsersModule, auth_module_1.AuthModule, activity_module_1.ActivityModule, time_tracking_module_1.TimeTrackingModule, chat_module_1.ChatModule, meetings_module_1.MeetingsModule, feedback_module_1.FeedbackModule],
        controllers: [app_controller_1.AppController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map