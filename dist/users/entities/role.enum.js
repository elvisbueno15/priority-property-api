"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = void 0;
var Role;
(function (Role) {
    Role["OWNER"] = "owner";
    Role["ADMIN"] = "admin";
    Role["EMPLOYEE"] = "employee";
    // legacy roles kept so old accounts still validate
    Role["CALLER"] = "caller";
    Role["VIEWER"] = "viewer";
    Role["MODERATOR"] = "moderator";
})(Role || (exports.Role = Role = {}));
//# sourceMappingURL=role.enum.js.map