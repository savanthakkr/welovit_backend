const dbQuery = require("../helpers/query");
let constants = require("../vars/constants");
const utility = require('../helpers/utility');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require("fs");
const path = require("path");
const configPath = path.join(__dirname, "../config/smsConfig.json");
const PDFDocument = require("pdfkit");


// exports.createTenantDatabase = async (req, res) => {
//     try {
//         let response = { status: "error", msg: "" };
//         let body = req?.body?.inputdata;

//         if (utility.checkEmptyString(body?.tenant_name)) {
//             response.msg = "Tenant name is required.";
//             return utility.apiResponse(req, res, response);
//         }

//         if (utility.checkEmptyString(body?.db_name)) {
//             response.msg = "Database name is required.";
//             return utility.apiResponse(req, res, response);
//         }

//         // clean db name: only lowercase letters, numbers, underscore
//         const rawDbName = body.db_name.toLowerCase().trim();
//         const dbName = rawDbName.replace(/[^a-z0-9_]/g, "");

//         if (utility.checkEmptyString(dbName)) {
//             response.msg = "Invalid database name.";
//             return utility.apiResponse(req, res, response);
//         }

//         // ✅ CHECK if tenant already exists in master table
//         const existingTenant = await dbQuery.fetchSingleRecord(
//             constants.vals.defaultDB,
//             "tenants",
//             `WHERE db_name='${dbName}'`,
//             "*"
//         );

//         let tenant_id = null;

//         if (existingTenant) {
//             tenant_id = existingTenant.tenant_id;
//         }

//         // ✅ CHECK if MySQL database already exists
//         const existDb = await dbQuery.rawQuery(
//             constants.vals.defaultDB,
//             `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '${dbName}'`
//         );

//         if (!existDb || existDb.length === 0) {
//             // ✅ CREATE DATABASE if not exists
//             await dbQuery.rawQuery(constants.vals.defaultDB, `CREATE DATABASE ${dbName}`);

//             // ✅ CREATE users table if fresh database
//             await dbQuery.rawQuery(
//                 dbName,
//                 `CREATE TABLE IF NOT EXISTS users (
//                     user_id INT AUTO_INCREMENT PRIMARY KEY,
//                     created_at DATETIME NOT NULL,
//                     updated_at DATETIME NOT NULL
//                 )`
//             );
//         }

//         // ✅ Insert into tenants table ONLY IF NOT EXISTS
//         if (!tenant_id) {
//             const now = req.locals?.now || new Date();
//             const params = {
//                 tenant_name: body.tenant_name,
//                 db_name: dbName,
//                 created_at: now
//             };

//             const insertRes = await dbQuery.insertSingle(constants.vals.defaultDB, "tenants", params);
//             tenant_id = insertRes?.insertId;
//         }

//         // ✅ Ensure success response
//         response.status = "success";
//         response.msg = "Tenant database ready.";
//         response.data = { tenant_id, db_name: dbName, tenant_name: body.tenant_name };

//         return utility.apiResponse(req, res, response);

//     } catch (err) {
//         console.log("Tenant DB creation error:", err);
//         response.status = "error";
//         response.msg = "Internal server error.";
//         return utility.apiResponse(req, res, response);
//     }
// };



// exports.addRegisterFields = async (req, res) => {
//     try {
//         let response = { status: "error", msg: "" };
//         let body = req?.body?.inputdata;

//         if (!body?.tenant_id) {
//             response.msg = "tenant_id is required.";
//             return utility.apiResponse(req, res, response);
//         }

//         if (!Array.isArray(body?.fields) || body.fields.length === 0) {
//             response.msg = "At least one field is required.";
//             return utility.apiResponse(req, res, response);
//         }

//         // Fetch tenant info
//         const tenant = await dbQuery.fetchSingleRecord(
//             constants.vals.defaultDB,
//             "tenants",
//             `WHERE tenant_id=${body.tenant_id}`,
//             "*"
//         );

//         if (!tenant) {
//             response.msg = "Invalid tenant_id.";
//             return utility.apiResponse(req, res, response);
//         }

//         const tenantDb = tenant.db_name;
//         const now = req.locals?.now || new Date();

//         // ✅ Ensure users table exists with only user_id initially
//         await dbQuery.rawQuery(
//             tenantDb,
//             `CREATE TABLE IF NOT EXISTS users (
//                 user_id INT AUTO_INCREMENT PRIMARY KEY
//             )`
//         );

//         // ✅ Add dynamic fields AFTER user_id
//         for (let f of body.fields) {
//             const fieldName = f.name;
//             const fieldType = f.type || "VARCHAR(255)";
//             const is_required = f.is_required ? "NOT NULL" : "NULL";
//             const is_unique = f.is_unique ? 1 : 0;

//             // ✅ Check if field already exists
//             const columnExists = await dbQuery.rawQuery(
//                 tenantDb,
//                 `SELECT COLUMN_NAME 
//                  FROM INFORMATION_SCHEMA.COLUMNS 
//                  WHERE TABLE_SCHEMA='${tenantDb}' 
//                  AND TABLE_NAME='users' 
//                  AND COLUMN_NAME='${fieldName}'`
//             );

//             if (columnExists.length === 0) {
//                 await dbQuery.rawQuery(
//                     tenantDb,
//                     `ALTER TABLE users ADD COLUMN ${fieldName} ${fieldType} ${is_required} AFTER user_id`
//                 );
//             }

//             // ✅ Add unique constraint if required
//             if (is_unique) {
//                 await dbQuery.rawQuery(
//                     tenantDb,
//                     `ALTER TABLE users ADD UNIQUE INDEX idx_${fieldName}_unique (${fieldName})`
//                 );
//             }

//             // ✅ Store metadata in master DB
//             await dbQuery.insertSingle(constants.vals.defaultDB, "registration_fields", {
//                 tenant_id: body.tenant_id,
//                 field_name: fieldName,
//                 field_type: fieldType,
//                 is_required: f.is_required ? 1 : 0,
//                 is_unique: is_unique,
//                 created_at: now
//             });
//         }

//         // ✅ Ensure created_at, updated_at, deleted_at exist at END
//         const timestampColumns = [
//             { name: "created_at", def: "DATETIME NOT NULL" },
//             { name: "updated_at", def: "DATETIME NOT NULL" },
//             { name: "deleted_at", def: "DATETIME NULL" }
//         ];

//         for (let col of timestampColumns) {
//             const exists = await dbQuery.rawQuery(
//                 tenantDb,
//                 `SELECT COLUMN_NAME 
//                  FROM INFORMATION_SCHEMA.COLUMNS 
//                  WHERE TABLE_SCHEMA='${tenantDb}' 
//                  AND TABLE_NAME='users' 
//                  AND COLUMN_NAME='${col.name}'`
//             );

//             if (exists.length === 0) {
//                 await dbQuery.rawQuery(
//                     tenantDb,
//                     `ALTER TABLE users ADD COLUMN ${col.name} ${col.def} LAST`
//                 );
//             }
//         }

//         response.status = "success";
//         response.msg = "Registration fields added successfully.";
//         return utility.apiResponse(req, res, response);

//     } catch (err) {
//         console.log("Add register fields error:", err);
//         response.status = "error";
//         response.msg = "Internal server error.";
//         return utility.apiResponse(req, res, response);
//     }
// };




// Login



exports.adminLogin = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        const bodyData = req?.body?.inputdata;

        // ✅ Validation messages
        const messages = {
            email: "Email is required.",
            password: "Password is required."
        };

        // ✅ Validate empty fields
        for (let key in messages) {
            if (!bodyData[key] || bodyData[key].trim() === "") {
                response.msg = messages[key];
                return utility.apiResponse(req, res, response);
            }
        }

        // ✅ Fetch admin by email
        const condition = `WHERE admin_Email = '${bodyData.email}' AND is_active = 1 AND is_delete = 0`;
        const selectFields = "admin_Id, admin_Name, admin_Email, admin_Password, admin_Type, admin_Company_Name, admin_Company_Logo";

        const adminData = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, "admins", condition, selectFields);

        console.log(adminData);
        console.log("dnakjhdjasdhjsa");


        if (!adminData || adminData.length === 0) {
            response.msg = "Admin not found.";
            return utility.apiResponse(req, res, response);
        }

        const admin = adminData;
        const passwordCheck = await (bodyData.password, admin.admin_Password);

        if (!passwordCheck) {
            response.msg = "Password incorrect.";
            return utility.apiResponse(req, res, response);
        }

        // ✅ Remove password for security
        delete admin.admin_Password;

        // ✅ Generate role-based JWT token
        // let tokenSecret =
        //   admin.admin_Type === "superadmin" ? JWT_SECRET_SUPERADMIN : JWT_SECRET_ADMIN;

        // const token = jwt.sign(
        //   { admin_Id: admin.admin_Id, role: admin.admin_Type, email: admin.admin_Email },
        // //   tokenSecret,
        //   { expiresIn: "7d" }
        // );

        const token = jwt.sign({ dmin_Id: admin.admin_Id, role: admin.admin_Type, }, 'apiservice');

        // ✅ Store token in admin_token table
        const params = {
            admin_Id: admin.admin_Id,
            admin_token_JWT: token,
            admin_token_Firebase: bodyData?.firebase_Token || "",
            created_at: req.locals.now,
            is_active: 1,
            is_delete: 0
        };

        await dbQuery.insertSingle(constants.vals.defaultDB, "admin_token", params);

        // ✅ Prepare success response
        response.status = "success";
        response.msg = "Login successful.";
        response.data = {
            admin: {
                admin_Id: admin.admin_Id,
                admin_Name: admin.admin_Name,
                admin_Email: admin.admin_Email,
                admin_Type: admin.admin_Type,
                admin_Company_Name: admin.admin_Company_Name,
                admin_Company_Logo: admin.admin_Company_Logo
            },
            token
        };

        return utility.apiResponse(req, res, response);
    } catch (error) {
        console.error("Admin login error:", error);
        return res.status(500).json({ status: "error", msg: "Internal server error" });
    }
};

exports.getAdminProfile = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };

        const userInfo = req.userInfo; // comes from adminAuthentication middleware

        if (!userInfo) {
            response.msg = "Invalid token.";
            return utility.apiResponse(req, res, response);
        }

        // Remove sensitive fields if needed
        delete userInfo.admin_Password;

        response.status = "success";
        response.msg = "Profile fetched successfully.";
        response.data = {
            admin: {
                admin_Id: userInfo.admin_Id,
                admin_Name: userInfo.admin_Name,
                admin_Email: userInfo.admin_Email,
                admin_Type: userInfo.admin_Type,
                admin_Company_Name: userInfo.admin_Company_Name,
                admin_Company_Logo: userInfo.admin_Company_Logo
            }
        };

        return utility.apiResponse(req, res, response);

    } catch (error) {
        console.error("Get Admin Profile Error:", error);
        return res.status(500).json({
            status: "error",
            msg: "Internal server error"
        });
    }
};


// Add admin 
exports.addAdmin = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let bodyData = req?.body?.inputdata;

        // ==========================
        // ONLY SUPERADMIN CAN ADD ADMIN
        // ==========================

        console.log(req.userInfo);
        console.log("dkasjdjahsdj");


        if (req.userInfo.admin_Type !== "superadmin") {
            response.msg = "Only superadmin can add admins.";
            return utility.apiResponse(req, res, response);
        }

        // ==========================
        // REQUIRED FIELDS
        // ==========================
        const messages = {
            admin_Name: "Admin name is required.",
            admin_Email: "Email is required.",
            admin_Password: "Password is required.",
            admin_Type: "Admin type is required."
        };

        for (let key in messages) {
            if (utility.checkEmptyString(bodyData[key])) {
                response.msg = messages[key];
                return utility.apiResponse(req, res, response);
            }
        }

        // ==========================
        // CHECK ADMIN TYPE
        // ==========================
        if (!["superadmin", "admin"].includes(bodyData.admin_Type)) {
            response.msg = "Invalid admin type. Allowed: superadmin, admin.";
            return utility.apiResponse(req, res, response);
        }

        // ==========================
        // CHECK IF EMAIL EXISTS
        // ==========================
        let condition = `WHERE admin_Email = '${bodyData.admin_Email}' AND is_active = 1 AND is_delete = 0`;
        let findAdmin = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "admins",
            condition,
            "admin_Id"
        );

        if (findAdmin && findAdmin.length !== 0) {
            response.msg = "Email already exists.";
            return utility.apiResponse(req, res, response);
        }

        // ==========================
        // HASH PASSWORD
        // ==========================
        const hashedPassword = await bcrypt.hash(bodyData.admin_Password, 10);

        // ==========================
        // INSERT INTO admins TABLE
        // ==========================
        const params = {
            admin_Name: bodyData.admin_Name,
            admin_Email: bodyData.admin_Email,
            admin_Password: hashedPassword,
            admin_Address: bodyData.admin_Address || "",
            admin_Type: bodyData.admin_Type,
            admin_Company_Name: bodyData.admin_Company_Name || "",
            admin_Company_Logo: bodyData.admin_Company_Logo || "",
            status: 1,
            is_active: 1,
            is_delete: 0,
            created_at: req.locals.now
        };

        const newAdminId = await dbQuery.insertSingle(
            constants.vals.defaultDB,
            "admins",
            params
        );

        if (!newAdminId) {
            response.msg = "Failed to add admin.";
            return utility.apiResponse(req, res, response);
        }

        // ==========================
        // SUCCESS RESPONSE
        // ==========================
        response.status = "success";
        response.msg = "Admin added successfully.";
        response.data = { admin_Id: newAdminId };

        return utility.apiResponse(req, res, response);

    } catch (error) {
        console.log("Add Admin Error:", error);
        throw error;
    }
};

// Get all admin list
exports.adminList = async (req, res) => {
    try {

        let response = { status: "error", msg: "" };

        // =====================================
        // ONLY SUPERADMIN CAN SEE ADMIN LIST
        // =====================================
        if (req.userInfo.admin_Type !== "superadmin") {
            response.msg = "Only superadmin can access admin list.";
            return utility.apiResponse(req, res, response);
        }

        // =====================================
        // FETCH ADMINS
        // =====================================
        let condition = `WHERE admin_Type = 'admin' AND is_delete = 0 ORDER BY created_at DESC`;
        let fields = `
            admin_Id,
            admin_Name,
            admin_Email,
            admin_Address,
            admin_Type,
            admin_Company_Name,
            admin_Company_Logo,
            status,
            is_active,
            created_at,
            updated_at
        `;

        const adminData = await dbQuery.fetchRecords(
            constants.vals.defaultDB,
            "admins",
            condition,
            fields
        );

        response.status = "success";
        response.msg = "Admin list fetched successfully.";
        response.data = adminData;
        return utility.apiResponse(req, res, response);

    } catch (error) {
        console.log("Admin List Error:", error);
        throw error;
    }
};

// Edit Admin 
exports.updateAdmin = async (req, res) => {
    try {

        let response = { status: 'error', msg: '' };
        let bodyData = req?.body?.inputdata;

        // Required fields
        let messages = {
            admin_Id: 'Admin ID is required.',
            admin_Name: 'Name is required.',
            admin_Email: 'Email is required.',
            admin_Address: 'Address is required.',
            admin_Company_Name: 'Company name is required.',
            admin_Company_Logo: 'Company logo is required.',
            admin_Type: 'Admin type is required (admin only)'
        };

        const { edit_password, admin_Id, ...restData } = bodyData;

        // Superadmin security check (ONLY superadmin can update admin)
        if (req.userInfo.admin_Type !== "superadmin") {
            response.msg = "Only superadmin can update admin details.";
            return utility.apiResponse(req, res, response);
        }

        // Input validation
        for (let key in restData) {
            if (utility.checkEmptyString(restData[key])) {
                response.msg = messages[key];
                return utility.apiResponse(req, res, response);
            }
        }

        // Check admin exists
        let condition = `WHERE admin_Id = ${admin_Id} AND is_delete = 0`;
        const checkAdmin = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            'admins',
            condition,
            'admin_Id'
        );

        if (Array.isArray(checkAdmin) && checkAdmin.length === 0) {
            response.msg = "Admin not found in system.";
            return utility.apiResponse(req, res, response);
        }

        // Duplicate email check (must not match other admin)
        let emailCondition = `
            WHERE admin_Email = '${bodyData.admin_Email}'
            AND admin_Id != ${admin_Id}
            AND is_delete = 0
        `;
        const checkEmail = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "admins",
            emailCondition,
            "admin_Id"
        );

        if (!Array.isArray(checkEmail) || checkEmail.length > 0) {
            response.msg = "Email already used by another admin.";
            return utility.apiResponse(req, res, response);
        }

        // Build update fields
        const date = req.locals.now;

        let updateValue = `
            admin_Name = '${bodyData.admin_Name}',
            admin_Email = '${bodyData.admin_Email}',
            admin_Address = '${bodyData.admin_Address}',
            admin_Company_Name = '${bodyData.admin_Company_Name}',
            admin_Company_Logo = '${bodyData.admin_Company_Logo}',
            admin_Type = 'admin',
            updated_at = '${date}'
        `;

        // Update password only if "edit_password" = true
        if (edit_password) {
            const hashPassword = await bcrypt.hash(bodyData.admin_Password, 10);
            updateValue += `, admin_Password = '${hashPassword}'`;
        }

        const updateCondition = `admin_Id = ${admin_Id}`;

        const updateData = await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "admins",
            updateCondition,
            updateValue
        );

        if (!updateData) {
            response.msg = "Unable to update admin (DB error).";
            return utility.apiResponse(req, res, response);
        }

        response.status = "success";
        response.msg = "Admin updated successfully.";
        return utility.apiResponse(req, res, response);

    } catch (error) {
        console.log("Update Admin Error:", error);
        throw error;
    }
};

// Logout Admin
exports.logout = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let userInfo = req?.userInfo;

        const condition = `admin_Id = ${userInfo?.admin_Id} AND admin_token_JWT = '${userInfo?.admin_token_JWT}' AND admin_token_Id = ${userInfo?.admin_token_Id}`;

        await dbQuery.deleteRecord(constants.vals.defaultDB, 'admin_token', condition);

        response['status'] = 'success';
        response['msg'] = 'You have been logged out successfully.';
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}

// Delete Admin
exports.deleteAdmin = async (req, res) => {
    try {

        let response = { status: 'error', msg: '' };
        let bodyData = req?.body?.inputdata;

        // Check permission → Only superadmin can delete admin
        if (req.userInfo.admin_Type !== "superadmin") {
            response.msg = "Only superadmin can delete admin.";
            return utility.apiResponse(req, res, response);
        }

        // Validate ID
        if (utility.checkEmptyString(bodyData?.admin_Id)) {
            response.msg = "Admin ID is required.";
            return utility.apiResponse(req, res, response);
        }

        // Check admin exists and is not already deleted
        let condition = `WHERE admin_Id = ${bodyData?.admin_Id} AND is_delete = 0`;
        let selectFields = 'admin_Id, admin_Type';

        const checkAdmin = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            'admins',
            condition,
            selectFields
        );

        if (Array.isArray(checkAdmin) && checkAdmin.length === 0) {
            response.msg = 'Admin not found in system.';
            return utility.apiResponse(req, res, response);
        }

        // Prevent deleting superadmin
        if (checkAdmin.admin_Type === "superadmin") {
            response.msg = "Superadmin cannot be deleted.";
            return utility.apiResponse(req, res, response);
        }

        // Soft delete
        const date = req.locals.now;
        const newValue = `is_delete = 1, deleted_at = '${date}'`;
        const updateCondition = `admin_Id = ${bodyData?.admin_Id}`;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            'admins',
            updateCondition,
            newValue
        );

        response.status = 'success';
        response.msg = 'Admin deleted successfully.';
        return utility.apiResponse(req, res, response);

    } catch (error) {
        console.log("Delete Admin Error:", error);
        throw error;
    }
};


// ============================================
// CUSTOMER (USER) MANAGEMENT FOR ADMIN PANEL
// ============================================

// List customers (with optional filters)
exports.listCustomers = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata || {};

        let page = parseInt(body.page) || 1;
        let limit = parseInt(body.limit) || 10;
        let offset = (page - 1) * limit;

        let where = "WHERE is_delete = 0";

        // Filter by status
        if (body.status === "active") {
            where += " AND is_active = 1";
        } else if (body.status === "inactive" || body.status === "deactive") {
            where += " AND is_active = 0";
        }

        // Search by name or mobile
        if (body.search && body.search.trim() !== "") {
            const search = body.search.trim();
            where += ` AND (user_Name LIKE '%${search}%' OR user_Mobile LIKE '%${search}%')`;
        }

        const listQuery = `
            SELECT 
                user_id,
                user_Name,
                user_Mobile,
                user_Profile_Photo,
                user_Wallet_Amount,
                is_active,
                created_at
            FROM users
            ${where}
            ORDER BY user_id DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM users
            ${where}
        `;

        const list = await dbQuery.rawQuery(constants.vals.defaultDB, listQuery);
        const countRows = await dbQuery.rawQuery(constants.vals.defaultDB, countQuery);
        const total = countRows?.[0]?.total || 0;

        // Attach full URL for profile photo if present
        for (let u of list) {
            if (u.user_Profile_Photo) {
                u.user_Profile_Photo =
                    constants.vals.frontEndUserProfilePath + u.user_Profile_Photo;
            }
        }

        response.status = "success";
        response.msg = "Customer list fetched successfully.";
        response.data = {
            list,
            pagination: {
                page,
                limit,
                total
            }
        };

        return utility.apiResponse(req, res, response);

    } catch (error) {
        console.log("List Customers Error:", error);
        throw error;
    }
};


// Get single customer details by user_id
exports.getCustomerDetails = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata || {};

        if (!body.user_id) {
            response.msg = "User ID is required.";
            return utility.apiResponse(req, res, response);
        }

        let condition = `WHERE user_id = ${body.user_id} AND is_delete = 0`;
        let selectFields = `
            user_id,
            user_Name,
            user_Mobile,
            user_Solun_Name,
            user_Ref_Code,
            user_Profile_Photo,
            user_Wallet_Amount,
            user_Firebase_Token,
            is_active,
            created_at,
            updated_at
        `;

        const userData = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "users",
            condition,
            selectFields
        );

        if (!userData || (Array.isArray(userData) && userData.length === 0)) {
            response.msg = "User not found.";
            return utility.apiResponse(req, res, response);
        }

        // Normalise when driver returns plain object
        const user = Array.isArray(userData) ? userData[0] : userData;

        if (user.user_Profile_Photo) {
            user.user_Profile_Photo =
                constants.vals.frontEndUserProfilePath + user.user_Profile_Photo;
        }

        // Optional: Basic order stats for quick view
        const ordersStats = await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `
            SELECT 
                COUNT(*) AS orders_count,
                IFNULL(SUM(total_amount), 0) AS total_spent
            FROM user_orders
            WHERE user_id = ${body.user_id}
            `
        );

        user.orders_count = ordersStats?.[0]?.orders_count || 0;
        user.total_spent = ordersStats?.[0]?.total_spent || 0;

        response.status = "success";
        response.msg = "Customer details fetched successfully.";
        response.data = user;

        return utility.apiResponse(req, res, response);

    } catch (error) {
        console.log("Get Customer Details Error:", error);
        throw error;
    }
};


// Get orders of a specific customer
exports.getCustomerOrders = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata || {};

        if (!body.user_id) {
            response.msg = "User ID is required.";
            return utility.apiResponse(req, res, response);
        }

        let where = `WHERE o.user_id = ${body.user_id}`;

        if (body.order_status) {
            where += ` AND o.order_status='${body.order_status}'`;
        }

        if (body.payment_mode) {
            where += ` AND o.payment_mode='${body.payment_mode}'`;
        }

        const sql = `
            SELECT 
                o.order_id,
                o.total_amount,
                o.order_status,
                o.admin_status,
                o.payment_mode,
                o.created_at
            FROM user_orders o
            ${where}
            ORDER BY o.order_id DESC
        `;

        const orders = await dbQuery.rawQuery(constants.vals.defaultDB, sql);

        response.status = "success";
        response.msg = "Customer orders fetched successfully.";
        response.data = { orders };

        return utility.apiResponse(req, res, response);

    } catch (error) {
        console.log("Get Customer Orders Error:", error);
        throw error;
    }
};


// Activate customer (set is_active = 1)
exports.activateCustomer = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata || {};

        if (!body.user_id) {
            response.msg = "User ID is required.";
            return utility.apiResponse(req, res, response);
        }

        const date = req.locals.now;

        const updateValue = `
            is_active = 1,
            is_delete = 0,
            updated_at = '${date}'
        `;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "users",
            `user_id = ${body.user_id}`,
            updateValue
        );

        response.status = "success";
        response.msg = "Customer activated successfully.";

        return utility.apiResponse(req, res, response);

    } catch (error) {
        console.log("Activate Customer Error:", error);
        throw error;
    }
};


// Deactivate customer (set is_active = 0)
exports.deactivateCustomer = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata || {};

        if (!body.user_id) {
            response.msg = "User ID is required.";
            return utility.apiResponse(req, res, response);
        }

        const date = req.locals.now;

        const updateValue = `
            is_active = 0,
            updated_at = '${date}'
        `;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "users",
            `user_id = ${body.user_id}`,
            updateValue
        );

        response.status = "success";
        response.msg = "Customer deactivated successfully.";

        return utility.apiResponse(req, res, response);

    } catch (error) {
        console.log("Deactivate Customer Error:", error);
        throw error;
    }
};


// CATEGORY: ADD
exports.addCategory = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let adminInfo = req?.userInfo;

        if (utility.checkEmptyString(body.category_Name)) {
            response.msg = "Category name is required.";
            return utility.apiResponse(req, res, response);
        }

        const slug = makeSlug(body.category_Name);

        // Fetch category (both active + deleted)
        const existing = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "categories",
            `WHERE category_Name='${body.category_Name}'`,
            "category_id, is_delete"
        );

        // Case 1: Category exists and is active → Not allowed
        if (existing && existing.length !== 0 && existing.is_delete == 0) {
            response.msg = "Category already exists.";
            return utility.apiResponse(req, res, response);
        }

        // Case 2: Category exists but deleted → Allow re-add by updating record
        if (existing && existing.length !== 0 && existing.is_delete == 1) {
            const updateValue = `
                is_delete = 0,
                admin_Id = ${adminInfo.admin_Id},
                updated_at = '${req.locals.now}'
            `;
            await dbQuery.updateRecord(
                constants.vals.defaultDB,
                "categories",
                `category_id=${existing.category_id}`,
                updateValue
            );

            response.status = "success";
            response.msg = "Category restored successfully.";
            return utility.apiResponse(req, res, response);
        }

        // Case 3: Completely new category → Insert new row
        const params = {
            admin_Id: adminInfo.admin_Id,
            category_Name: body.category_Name,
            category_Slug: slug,
            created_at: req.locals.now
        };

        await dbQuery.insertSingle(constants.vals.defaultDB, "categories", params);

        response.status = "success";
        response.msg = "Category added successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};



// CATEGORY: EDIT
exports.editCategory = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let adminInfo = req?.userInfo;

        if (!body.category_id) {
            response.msg = "Category ID is required.";
            return utility.apiResponse(req, res, response);
        }

        if (utility.checkEmptyString(body.category_Name)) {
            response.msg = "Category name is required.";
            return utility.apiResponse(req, res, response);
        }

        const category = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "categories",
            `WHERE category_id=${body.category_id} AND is_delete=0`,
            "category_id, admin_Id"
        );

        if (!category || category.length === 0) {
            response.msg = "Category not found.";
            return utility.apiResponse(req, res, response);
        }

        // Admin cannot modify categories of other admins
        if (adminInfo.admin_Type === "admin" && category.admin_Id !== adminInfo.admin_Id) {
            response.msg = "You are not allowed to edit this category.";
            return utility.apiResponse(req, res, response);
        }

        const slug = makeSlug(body.category_Name);

        const updateValue = `
            category_Name='${body.category_Name}',
            category_Slug='${slug}',
            updated_at='${req.locals.now}'
        `;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "categories",
            `category_id=${body.category_id}`,
            updateValue
        );

        response.status = "success";
        response.msg = "Category updated successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};


// CATEGORY: DELETE
exports.deleteCategory = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let adminInfo = req?.userInfo;

        if (!body.category_id) {
            response.msg = "Category ID is required.";
            return utility.apiResponse(req, res, response);
        }

        const category = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "categories",
            `WHERE category_id=${body.category_id} AND is_delete=0`,
            "category_id, admin_Id"
        );

        if (!category || category.length === 0) {
            response.msg = "Category not found.";
            return utility.apiResponse(req, res, response);
        }

        // Admin Ownership Check
        if (adminInfo.admin_Type === "admin" && category.admin_Id !== adminInfo.admin_Id) {
            response.msg = "You are not allowed to delete this category.";
            return utility.apiResponse(req, res, response);
        }

        const date = req.locals.now;

        // ----------------------------
        // DELETE MAIN CATEGORY
        // ----------------------------
        const updateCategory = `
            is_delete=1,
            deleted_at='${date}',
            updated_at='${date}'
        `;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "categories",
            `category_id=${body.category_id}`,
            updateCategory
        );

        // ----------------------------
        // CASCADE DELETE SUBCATEGORIES
        // ----------------------------
        const updateSub = `
            is_delete=1,
            deleted_at='${date}',
            updated_at='${date}'
        `;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "sub_categories",
            `category_Id=${body.category_id}`,
            updateSub
        );

        response.status = "success";
        response.msg = "Category and all related subcategories deleted successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};


// CATEGORY: LIST WITH PAGINATION
exports.listCategory = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let admin = req?.userInfo;

        let where = "WHERE c.is_delete = 0";

        // If normal admin → show only his categories
        if (admin.admin_Type === "admin") {
            where += ` AND c.admin_Id = ${admin.admin_Id}`;
        }

        const listQuery = `
            SELECT 
                c.category_id,
                c.category_Name,
                c.category_Slug,
                c.admin_Id,
                c.created_at,
                a.admin_Name
            FROM categories AS c
            LEFT JOIN admins AS a ON c.admin_Id = a.admin_Id
            ${where}
            ORDER BY c.category_id DESC
        `;

        const list = await dbQuery.rawQuery(constants.vals.defaultDB, listQuery);

        response.status = "success";
        response.msg = "Category list fetched.";
        response.data = list;

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};







// SUB CATEGORY: ADD
exports.addSubCategory = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let adminInfo = req?.userInfo;

        if (!body.category_Id) {
            response.msg = "Category ID is required.";
            return utility.apiResponse(req, res, response);
        }
        if (utility.checkEmptyString(body.sub_Category_Name)) {
            response.msg = "Sub category name is required.";
            return utility.apiResponse(req, res, response);
        }

        const exists = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "sub_categories",
            `WHERE sub_Category_Name='${body.sub_Category_Name}' AND category_Id=${body.category_Id} AND is_delete=0`,
            "sub_category_id"
        );

        if (!(Array.isArray(exists) && exists.length === 0)) {
            response.msg = "Sub category already exists.";
            return utility.apiResponse(req, res, response);
        }

        const slug = makeSlug(body.sub_Category_Name);

        const params = {
            admin_Id: adminInfo.admin_Id,
            category_Id: body.category_Id,
            sub_Category_Name: body.sub_Category_Name,
            sub_Category_Slug: slug,
            created_at: req.locals.now
        };

        await dbQuery.insertSingle(constants.vals.defaultDB, "sub_categories", params);

        response.status = "success";
        response.msg = "Sub category added successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};


//  SUB CATEGORY: EDIT
exports.editSubCategory = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let adminInfo = req?.userInfo;

        if (!body.sub_category_id) {
            response.msg = "Sub category ID is required.";
            return utility.apiResponse(req, res, response);
        }
        if (!body.category_Id) {
            response.msg = "Category ID is required.";
            return utility.apiResponse(req, res, response);
        }
        if (utility.checkEmptyString(body.sub_Category_Name)) {
            response.msg = "Sub category name is required.";
            return utility.apiResponse(req, res, response);
        }

        const sub = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "sub_categories",
            `WHERE sub_category_id=${body.sub_category_id} AND is_delete=0`,
            "sub_category_id, admin_Id"
        );

        if (!sub || sub.length === 0) {
            response.msg = "Sub category not found.";
            return utility.apiResponse(req, res, response);
        }

        if (adminInfo.admin_Type === "admin" && sub.admin_Id !== adminInfo.admin_Id) {
            response.msg = "You are not allowed to edit this sub category.";
            return utility.apiResponse(req, res, response);
        }

        const slug = makeSlug(body.sub_Category_Name);

        const updateValue = `
            category_Id=${body.category_Id},
            sub_Category_Name='${body.sub_Category_Name}',
            sub_Category_Slug='${slug}',
            updated_at='${req.locals.now}'
        `;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "sub_categories",
            `sub_category_id=${body.sub_category_id}`,
            updateValue
        );

        response.status = "success";
        response.msg = "Sub category updated successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};


//  SUB CATEGORY: DELETE
exports.deleteSubCategory = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let adminInfo = req?.userInfo;

        if (!body.sub_category_id) {
            response.msg = "Sub category ID is required.";
            return utility.apiResponse(req, res, response);
        }

        const sub = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "sub_categories",
            `WHERE sub_category_id=${body.sub_category_id} AND is_delete=0`,
            "sub_category_id, admin_Id"
        );

        if (!sub || sub.length === 0) {
            response.msg = "Sub category not found.";
            return utility.apiResponse(req, res, response);
        }

        if (adminInfo.admin_Type === "admin" && sub.admin_Id !== adminInfo.admin_Id) {
            response.msg = "You are not allowed to delete this sub category.";
            return utility.apiResponse(req, res, response);
        }

        const updateValue = `
            is_delete=1,
            deleted_at='${req.locals.now}',
            updated_at='${req.locals.now}'
        `;

        await dbQuery.updateRecord(constants.vals.defaultDB, "sub_categories", `sub_category_id=${body.sub_category_id}`, updateValue);

        response.status = "success";
        response.msg = "Sub category deleted successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};


//  SUB CATEGORY: LIST WITH PAGINATION
exports.listSubCategory = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let adminInfo = req?.userInfo;

        let where = "WHERE sc.is_delete = 0";

        // Admin-wise restriction
        if (adminInfo.admin_Type === "admin") {
            where += ` AND sc.admin_Id = ${adminInfo.admin_Id}`;
        }

        const listQuery = `
            SELECT 
                sc.sub_category_id,
                sc.category_Id,
                sc.sub_Category_Name,
                sc.sub_Category_Slug,
                sc.admin_Id,
                sc.created_at,
                c.category_Name,
                a.admin_Name
            FROM sub_categories AS sc
            LEFT JOIN categories AS c ON sc.category_Id = c.category_id
            LEFT JOIN admins AS a ON sc.admin_Id = a.admin_Id
            ${where}
            ORDER BY sc.sub_category_id DESC
        `;

        const list = await dbQuery.rawQuery(constants.vals.defaultDB, listQuery);

        response.status = "success";
        response.msg = "Sub category list fetched successfully.";
        response.data = list;

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};





//  SUB CATEGORY: LIST BY CATEGORY ID
exports.listSubCategoryByCategoryId = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let adminInfo = req?.userInfo;

        if (!body.category_Id) {
            response.msg = "Category ID is required.";
            return utility.apiResponse(req, res, response);
        }

        // ----------------------------------------
        // ADMIN-WISE ACCESS CONTROL
        // ----------------------------------------
        let condition = `WHERE category_Id=${body.category_Id} AND is_delete=0`;

        if (adminInfo.admin_Type === "admin") {
            // Admin can see only his own sub categories
            condition += ` AND admin_Id=${adminInfo.admin_Id}`;
        }

        const list = await dbQuery.fetchRecords(
            constants.vals.defaultDB,
            "sub_categories",
            `${condition} ORDER BY sub_category_id DESC`,
            "sub_category_id, sub_Category_Name, sub_Category_Slug, admin_Id"
        );

        response.status = "success";
        response.msg = "Sub category list fetched.";
        response.data = list;
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};



// Add Product
exports.addProduct = async (req, res) => {
  try {
    let body = req.body;
    let admin = req.userInfo;

    if (!body.product_name || !body.category_id || !body.sub_category_id) {
      return utility.apiResponse(req, res, { status: "error", msg: "Required fields missing" });
    }

    const slug = makeSlug(body.product_name);

    const productId = await dbQuery.insertSingle(
      constants.vals.defaultDB,
      "products",
      {
        admin_id: admin.admin_Id,
        category_id: body.category_id,
        sub_category_id: body.sub_category_id,
        product_name: body.product_name,
        product_slug: slug,
        product_description: body.product_description,

        brand: body.brand,
        manufacturer: body.manufacturer,
        packer: body.packer,
        item_form: body.item_form,
        product_benefits: body.product_benefits,
        weight: body.weight,
        product_dimensions: body.product_dimensions,

        product_tags: body.product_tags,
        created_at: req.locals.now
      }
    );

    // Images
    for (let img of body.images || []) {
      await dbQuery.insertSingle(constants.vals.defaultDB, "product_images", {
        product_id: productId,
        imageUrl: img
      });
    }

    // Variations
    for (let v of body.variations || []) {
      const variationId = await dbQuery.insertSingle(
        constants.vals.defaultDB,
        "product_variations",
        {
          product_id: productId,
          sku: v.sku,
          variation_name: v.variation_name,
          price: v.price,
          sale_price: v.sale_price,
          stock: v.stock,
          weight: v.weight,
          dimensions: v.dimensions
        }
      );

      for (let a of v.attributes || []) {
        await dbQuery.insertSingle(
          constants.vals.defaultDB,
          "variation_attribute_values",
          {
            variation_id: variationId,
            attribute_id: a.attribute_id,
            value_id: a.value_id
          }
        );
      }
    }

    return utility.apiResponse(req, res, {
      status: "success",
      msg: "Product added successfully",
      data: { product_id: productId }
    });

  } catch (err) { throw err; }
};
exports.updateProduct = async (req, res) => {
  let body = req.body.inputdata;

  if (!body.product_id) {
    return utility.apiResponse(req, res, { status: "error", msg: "Product ID required" });
  }

  await dbQuery.updateRecord(
    constants.vals.defaultDB,
    "products",
    `product_id=${body.product_id}`,
    `
      product_name='${body.product_name}',
      product_slug='${makeSlug(body.product_name)}',
      product_description='${body.product_description}',
      brand='${body.brand}',
      manufacturer='${body.manufacturer}',
      packer='${body.packer}',
      item_form='${body.item_form}',
      product_benefits='${body.product_benefits}',
      weight='${body.weight}',
      product_dimensions='${body.product_dimensions}',
      updated_at='${req.locals.now}'
    `
  );

  return utility.apiResponse(req, res, {
    status: "success",
    msg: "Product updated"
  });
};



exports.deleteProduct = async (req, res) => {
  let { product_id } = req.body.inputdata;

  await dbQuery.updateRecord(
    constants.vals.defaultDB,
    "products",
    `product_id=${product_id}`,
    `is_delete=1, status=0, deleted_at='${req.locals.now}'`
  );

  await dbQuery.updateRecord(
    constants.vals.defaultDB,
    "product_variations",
    `product_id=${product_id}`,
    `is_delete=1, deleted_at='${req.locals.now}'`
  );

  return utility.apiResponse(req, res, {
    status: "success",
    msg: "Product deleted"
  });
};




exports.getProductDetails = async (req, res) => {
  try {
    let { product_id } = req.body.inputdata;

    if (!product_id) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Product ID required."
      });
    }

    const product = await dbQuery.fetchSingleRecord(
      constants.vals.defaultDB,
      "products",
      `WHERE product_id=${product_id}`,
      "*"
    );

    if (!product) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Product not found."
      });
    }

    const imagesRows = await dbQuery.fetchRecords(
      constants.vals.defaultDB,
      "product_images",
      `WHERE product_id=${product_id}`,
      "product_image_id, imageUrl"
    );

    const variationsRows = await dbQuery.rawQuery(
      constants.vals.defaultDB,
      `
      SELECT *
      FROM product_variations
      WHERE product_id=${product_id}
      `
    );

    product.images = Array.isArray(imagesRows) ? imagesRows : [];
    product.variations = Array.isArray(variationsRows) ? variationsRows : [];

    return utility.apiResponse(req, res, {
      status: "success",
      msg: "Product fetched successfully.",
      data: product
    });

  } catch (err) {
    console.error(err);
    throw err;
  }
};








exports.listProduct = async (req, res) => {
  const list = await dbQuery.rawQuery(
    constants.vals.defaultDB,
    `
    SELECT 
      p.*,
      (
        SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'variation_id', v.variation_id,
            'sku', v.sku,
            'price', v.price,
            'sale_price', v.sale_price,
            'stock', v.stock
          )
        )
        FROM product_variations v
        WHERE v.product_id=p.product_id AND v.is_delete=0
      ) AS variations
    FROM products p
    WHERE p.is_delete=0
    ORDER BY p.product_id DESC
    `
  );

  return utility.apiResponse(req, res, {
    status: "success",
    msg: "Product list",
    data: list
  });
};







exports.uploadProductImages = async (req, res) => {
  try {
    let body = req.body;
    let admin = req.userInfo;

    if (!body.product_id) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Product ID is required."
      });
    }

    // Ownership check
    let product = await dbQuery.fetchSingleRecord(
      constants.vals.defaultDB,
      "products",
      `WHERE product_id=${body.product_id} AND is_delete=0`,
      "product_id, admin_id"
    );

    if (!product) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Product not found."
      });
    }

    if (admin.admin_Type === "admin" && product.admin_id !== admin.admin_Id) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Not allowed."
      });
    }

    const images = body.file || [];

    if (!Array.isArray(images) || images.length === 0) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Images required."
      });
    }

    for (let img of images) {
      await dbQuery.insertSingle(
        constants.vals.defaultDB,
        "product_images",
        {
          product_id: body.product_id,
          variation_id: body.variation_id || null,
          imageUrl: img,
          created_at: req.locals.now
        }
      );
    }

    return utility.apiResponse(req, res, {
      status: "success",
      msg: "Images uploaded successfully.",
      data: {
        product_id: body.product_id,
        variation_id: body.variation_id || null,
        images
      }
    });

  } catch (err) {
    throw err;
  }
};





exports.deleteProductImage = async (req, res) => {
  try {
    let { product_image_id } = req.body.inputdata;

    if (!product_image_id) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Image ID required."
      });
    }

    let img = await dbQuery.fetchSingleRecord(
      constants.vals.defaultDB,
      "product_images",
      `WHERE product_image_id=${product_image_id} AND is_delete=0`,
      "product_image_id"
    );

    if (!img) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Image not found."
      });
    }

    await dbQuery.updateRecord(
      constants.vals.defaultDB,
      "product_images",
      `product_image_id=${product_image_id}`,
      `is_delete=1, deleted_at='${req.locals.now}'`
    );

    return utility.apiResponse(req, res, {
      status: "success",
      msg: "Image deleted."
    });

  } catch (err) { throw err; }
};


exports.addAttribute = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let admin = req?.userInfo;

        if (!body.name || body.name.trim() === "") {
            response.msg = "Attribute name is required.";
            return utility.apiResponse(req, res, response);
        }

        const slug = makeSlug(body.name);

        // 🔍 CHECK DUPLICATE
        let condition = `WHERE name='${body.name}' AND is_delete=0`;

        if (admin.admin_Type === "admin") {
            condition += ` AND admin_id=${admin.admin_Id}`;
        }

        const exists = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "attributes",
            condition,
            "attribute_id"
        );

        console.log("Duplicate Check:", exists);

        // ❗ FIXED CHECK
        if (Array.isArray(exists) && exists.length > 0) {
            response.msg = "Attribute already exists for this admin.";
            return utility.apiResponse(req, res, response);
        }

        // INSERT DATA
        const params = {
            admin_id: admin.admin_Id,
            name: body.name,
            slug,
            created_at: req.locals.now
        };

        const insertId = await dbQuery.insertSingle(
            constants.vals.defaultDB,
            "attributes",
            params
        );

        response.status = "success";
        response.msg = "Attribute added successfully.";
        response.data = { attribute_id: insertId };
        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};




exports.editAttribute = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let admin = req?.userInfo;

        if (!body.attribute_id) {
            response.msg = "Attribute ID is required.";
            return utility.apiResponse(req, res, response);
        }
        if (!body.name) {
            response.msg = "Attribute name is required.";
            return utility.apiResponse(req, res, response);
        }

        let attr = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "attributes",
            `WHERE attribute_id=${body.attribute_id} AND is_delete=0`,
            "attribute_id, admin_id"
        );

        if (!attr) {
            response.msg = "Attribute not found.";
            return utility.apiResponse(req, res, response);
        }

        if (admin.admin_Type === "admin" && attr.admin_id !== admin.admin_Id) {
            response.msg = "You are not allowed to edit this attribute.";
            return utility.apiResponse(req, res, response);
        }

        const slug = makeSlug(body.name);

        const updateValue = `
            name='${body.name}',
            slug='${slug}',
            updated_at='${req.locals.now}'
        `;

        await dbQuery.updateRecord(constants.vals.defaultDB, "attributes", `attribute_id=${body.attribute_id}`, updateValue);

        response.status = "success";
        response.msg = "Attribute updated successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};


exports.deleteAttribute = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let admin = req?.userInfo;

        if (!body.attribute_id) {
            response.msg = "Attribute ID is required.";
            return utility.apiResponse(req, res, response);
        }

        let attr = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "attributes",
            `WHERE attribute_id=${body.attribute_id} AND is_delete=0`,
            "attribute_id, admin_id"
        );

        if (!attr) {
            response.msg = "Attribute not found.";
            return utility.apiResponse(req, res, response);
        }

        if (admin.admin_Type === "admin" && attr.admin_id !== admin.admin_Id) {
            response.msg = "You are not allowed to delete this attribute.";
            return utility.apiResponse(req, res, response);
        }

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "attributes",
            `attribute_id=${body.attribute_id}`,
            `is_delete=1, updated_at='${req.locals.now}'`
        );

        response.status = "success";
        response.msg = "Attribute deleted successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};

exports.addAttributeValue = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;

        if (!body.attribute_id) {
            response.msg = "Attribute ID is required.";
            return utility.apiResponse(req, res, response);
        }
        if (!body.value) {
            response.msg = "Value is required.";
            return utility.apiResponse(req, res, response);
        }

        const slug = makeSlug(body.value);

        let dup = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "attribute_values",
            `WHERE attribute_id=${body.attribute_id} AND value='${body.value}' AND is_delete=0`,
            "value_id"
        );

        
        if (Array.isArray(dup) && dup.length > 0) {
            response.msg = "Attribute value already exists.";
            return utility.apiResponse(req, res, response);
        }

        const params = {
            attribute_id: body.attribute_id,
            value: body.value,
            slug,
            created_at: req.locals.now
        };

        const insertId = await dbQuery.insertSingle(constants.vals.defaultDB, "attribute_values", params);

        response.status = "success";
        response.msg = "Value added successfully.";
        response.data = { value_id: insertId };
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};


exports.editAttributeValue = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;

        if (!body.value_id) {
            response.msg = "Value ID is required.";
            return utility.apiResponse(req, res, response);
        }
        if (!body.value) {
            response.msg = "Value is required.";
            return utility.apiResponse(req, res, response);
        }

        const slug = makeSlug(body.value);

        const updateValue = `
            value='${body.value}',
            slug='${slug}',
            updated_at='${req.locals.now}'
        `;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "attribute_values",
            `value_id=${body.value_id}`,
            updateValue
        );

        response.status = "success";
        response.msg = "Value updated successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};



exports.deleteAttributeValue = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;

        if (!body.value_id) {
            response.msg = "Value ID is required.";
            return utility.apiResponse(req, res, response);
        }

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "attribute_values",
            `value_id=${body.value_id}`,
            `is_delete=1, updated_at='${req.locals.now}'`
        );

        response.status = "success";
        response.msg = "Value deleted successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};


exports.listAttribute = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let admin = req?.userInfo;
        let { page = 1, limit = 10 } = req?.body?.inputdata || {};

        page = parseInt(page);
        limit = parseInt(limit);
        const offset = (page - 1) * limit;

        let where = "WHERE a.is_delete=0";

        if (admin.admin_Type === "admin") {
            where += ` AND a.admin_id=${admin.admin_Id}`;
        }

        const listQuery = `
            SELECT 
                a.attribute_id,
                a.name,
                a.slug,
                a.admin_id,
                a.created_at,
                ad.admin_Name
            FROM attributes AS a
            LEFT JOIN admins AS ad ON a.admin_id = ad.admin_Id
            ${where}
            ORDER BY a.attribute_id DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const list = await dbQuery.rawQuery(constants.vals.defaultDB, listQuery);

        const countQuery = `SELECT COUNT(*) AS total FROM attributes ${where.replace(/a\./g, "")}`;
        const countData = await dbQuery.rawQuery(constants.vals.defaultDB, countQuery);
        const total = countData?.[0]?.total ?? 0;

        response.status = "success";
        response.msg = "Attribute list fetched.";
        response.data = {
            list,
            pagination: { page, limit, total }
        };

        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};


exports.listAttributeValue = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;

        if (!body.attribute_id) {
            response.msg = "Attribute ID is required.";
            return utility.apiResponse(req, res, response);
        }

        const list = await dbQuery.fetchRecords(
            constants.vals.defaultDB,
            "attribute_values",
            `WHERE attribute_id=${body.attribute_id} AND is_delete=0 ORDER BY value_id DESC`,
            "value_id, value, slug, created_at"
        );

        response.status = "success";
        response.msg = "Attribute values fetched.";
        response.data = list;
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};


exports.listAttributeWithValues = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };

        const query = `
            SELECT 
                a.attribute_id, a.name AS attribute_name,
                v.value_id, v.value
            FROM attributes a
            LEFT JOIN attribute_values v ON a.attribute_id = v.attribute_id AND v.is_delete=0
            WHERE a.is_delete=0
            ORDER BY a.attribute_id DESC
        `;

        const rows = await dbQuery.rawQuery(constants.vals.defaultDB, query);

        let result = {};

        rows.forEach(row => {
            if (!result[row.attribute_id]) {
                result[row.attribute_id] = {
                    attribute_id: row.attribute_id,
                    attribute_name: row.attribute_name,
                    values: []
                };
            }
            if (row.value) {
                result[row.attribute_id].values.push({
                    value_id: row.value_id,
                    value: row.value
                });
            }
        });

        response.status = "success";
        response.msg = "Attributes fetched.";
        response.data = Object.values(result);
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};




// Add coupan
exports.addCoupon = async (req, res) => {
    try {
        let admin = req.userInfo;
        let body = req.body.inputdata;

        if (!body.coupon_Code || !body.coupons_Discount) {
            return utility.apiResponse(req, res, { status: "error", msg: "Coupon code & discount required" });
        }

        // Duplicate Check
        let dup = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "coupons",
            `WHERE coupon_Code='${body.coupon_Code}'`,
            "coupon_id"
        );


        

        if (Array.isArray(dup) && dup.length > 0) {
            return utility.apiResponse(req, res, { status: "error", msg: "Coupon already exists." });
        }

        let insertId = await dbQuery.insertSingle(constants.vals.defaultDB, "coupons", {
            coupon_Code: body.coupon_Code,
            coupons_Discount: body.coupons_Discount,
            coupons_Type: body.coupons_Type || "percentage",
            created_at: req.locals.now
        });

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Coupon added successfully.",
            data: { coupon_id: insertId }
        });

    } catch (err) { throw err; }
};


// list coupan
exports.listCoupons = async (req, res) => {
    let rows = await dbQuery.rawQuery(
        constants.vals.defaultDB,
        `SELECT * FROM coupons WHERE deleted_at IS NULL ORDER BY coupon_id DESC`
    );

    return utility.apiResponse(req, res, {
        status: "success",
        msg: "Coupon list",
        data: rows
    });
};


// delete coupan
exports.deleteCoupon = async (req, res) => {
    let id = req.body.inputdata.coupon_id;

    if (!id) return utility.apiResponse(req, res, { status: "error", msg: "Coupon ID required." });

    await dbQuery.updateRecord(
        constants.vals.defaultDB,
        "coupons",
        `coupon_id=${id}`,
        { deleted_at: req.locals.now }
    );

    return utility.apiResponse(req, res, { status: "success", msg: "Coupon deleted" });
};


// add offer
// add offer
exports.addOffer = async (req, res) => {
    try {
        let body = req.body.inputdata;

        if (!body.user_Id || !body.product_Id || !body.offer_Discount) {
            return utility.apiResponse(req, res, { status: "error", msg: "Required fields missing." });
        }

        // Check Product Exists
        let product = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "products",
            `WHERE product_id=${body.product_Id} AND status=1`,
            "product_id"
        );

        if (!product) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Invalid Product ID."
            });
        }

        // Check User Exists
        let user = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "users",
            `WHERE user_id=${body.user_Id} AND is_delete=0`,
            "user_id"
        );

        if (!user) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Invalid User ID."
            });
        }

        let insertId = await dbQuery.insertSingle(
            constants.vals.defaultDB,
            "offers",
            {
                user_Id: body.user_Id,
                product_Id: body.product_Id,
                offer_Discount: body.offer_Discount,
                offer_Type: body.offer_Type || "percentage",
                created_at: req.locals.now
            }
        );

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Offer added successfully.",
            data: { offer_id: insertId }
        });

    } catch (err) { throw err; }
};

exports.approveWithdraw = async (req, res) => {
    try {
        let body = req.body.inputdata;

        if (!body.withdraw_id) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Withdraw ID required."
            });
        }

        // Fetch withdrawal entry
        let row = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "user_wallets",
            `WHERE wallet_id=${body.withdraw_id}`,
            "user_id, amount, status"
        );

        if (!row) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Withdrawal entry not found."
            });
        }

        if (row.status === "completed") {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Already approved."
            });
        }

        // Mark as completed
        await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `UPDATE user_wallets
             SET status='completed'
             WHERE wallet_id=${body.withdraw_id}`
        );

        // Recalculate user's wallet balance
        await updateUserWalletBalance(row.user_id);

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Withdrawal approved successfully."
        });

    } catch (err) {
        throw err;
    }
};
exports.cancelShipment = async (req, res) => {
  let { waybill } = req.body.inputdata;

  await delhiveryRequest.post(
    "https://staging-express.delhivery.com/api/p/edit",
    {
      waybill,
      cancellation: true
    }
  );

  return utility.apiResponse(req, res, {
    status: "success",
    msg: "Shipment cancelled"
  });
};
exports.approveReturn = async (req, res) => {
  try {
    let { order_id } = req.body.inputdata;

    // 1️⃣ Approve return
    await dbQuery.updateRecord(
      constants.vals.defaultDB,
      "user_orders",
      `
      order_id=${order_id}
      AND return_status='requested'
      `,
      `
      return_status='approved',
      updated_at='${req.locals.now}'
      `
    );

    // 2️⃣ 🔥 AUTO CREATE RETURN SHIPMENT
    await createReturnShipmentInternal(order_id);

    return utility.apiResponse(req, res, {
      status: "success",
      msg: "Return approved & pickup scheduled"
    });

  } catch (err) {
    console.error("Approve Return Error:", err);
    return utility.apiResponse(req, res, {
      status: "error",
      msg: "Failed to approve return"
    });
  }
};
const createReturnShipmentInternal = async (order_id) => {
  const order = await dbQuery.fetchSingleRecord(
    constants.vals.defaultDB,
    `
    user_orders o
    JOIN user_addresses a ON o.address_id=a.address_id
    JOIN users u ON o.user_id=u.user_id
    `,
    `
    WHERE o.order_id=${order_id}
      AND o.return_status='approved'
      AND o.order_status='delivered'
    `,
    `
    o.order_id,
    o.total_amount,
    a.address,
    a.city,
    a.state,
    a.pincode,
    u.user_Name,
    u.user_Mobile
    `
  );

  if (!order) return;

  const payload = {
    shipments: [
      {
        name: order.user_Name,
        add: order.address,
        pin: order.pincode,
        city: order.city,
        state: order.state,
        country: "India",
        phone: order.user_Mobile,

        order: `RET-${order.order_id}`,
        payment_mode: "Prepaid",
        total_amount: order.total_amount,

        shipment_width: "20",
        shipment_height: "10",
        weight: "1",
        shipping_mode: "Surface",

        return_pin: "122003",
        return_city: "Gurugram",
        return_state: "Haryana",
        return_country: "India",
        return_phone: "9999999999",
        return_add: "Warehouse Address"
      }
    ],
    pickup_location: {
      name: "warehouse_name"
    }
  };

  const resp = await delhiveryRequest.post(
    "https://staging-express.delhivery.com/api/cmu/create.json",
    `format=json&data=${JSON.stringify(payload)}`
  );

  const waybill = resp?.data?.packages?.[0]?.waybill;

  if (waybill) {
    await dbQuery.updateRecord(
      constants.vals.defaultDB,
      "user_orders",
      `order_id=${order_id}`,
      `
      return_waybill='${waybill}',
      return_status='pickup_scheduled',
      updated_at='${new Date().toISOString().slice(0, 19).replace("T", " ")}'
      `
    );
  }
};


exports.rejectReturn = async (req, res) => {
  let { order_id, reason } = req.body.inputdata;

  await dbQuery.updateRecord(
    constants.vals.defaultDB,
    "user_orders",
    `
    order_id=${order_id}
    AND return_status='requested'
    `,
    `
    return_status='rejected',
    return_reject_reason='${reason}',
    updated_at='${req.locals.now}'
    `
  );

  return utility.apiResponse(req, res, {
    status: "success",
    msg: "Return rejected"
  });
};

exports.createShipment = async (req, res) => {
  let { order_id } = req.body.inputdata;

  const order = await dbQuery.fetchSingleRecord(
    constants.vals.defaultDB,
    "user_orders o JOIN user_addresses a ON o.address=a.address_id",
    `WHERE o.order_id=${order_id}`,
    "o.*, a.*"
  );

  const payload = {
    shipments: [{
      name: order.user_Name,
      add: order.address,
      pin: order.pincode,
      city: order.city,
      state: order.state,
      country: "India",
      phone: order.mobile,
      order: `ORD-${order.order_id}`,
      payment_mode: order.payment_mode === "COD" ? "COD" : "Prepaid",
      total_amount: order.total_amount,
      shipment_width: "20",
      shipment_height: "10",
      weight: "1",
      shipping_mode: "Surface"
    }],
    pickup_location: {
      name: "warehouse_name"
    }
  };

  const resp = await delhiveryRequest.post(
    "https://staging-express.delhivery.com/api/cmu/create.json",
    `format=json&data=${JSON.stringify(payload)}`
  );

  const waybill = resp.data?.packages?.[0]?.waybill;

  await dbQuery.updateRecord(
    constants.vals.defaultDB,
    "user_orders",
    `order_id=${order_id}`,
    `
    courier_partner='Delhivery',
    waybill='${waybill}',
    courier_status='shipment_created'
    `
  );

  return utility.apiResponse(req, res, {
    status: "success",
    msg: "Shipment created",
    data: { waybill }
  });
};

exports.rejectWithdraw = async (req, res) => {
    try {
        let body = req.body.inputdata;

        if (!body.withdraw_id) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Withdraw ID required."
            });
        }

        await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `UPDATE user_wallets
             SET status='rejected'
             WHERE wallet_id=${body.withdraw_id}`
        );

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Withdrawal rejected."
        });

    } catch (err) {
        throw err;
    }
};



// list offer
exports.listOffers = async (req, res) => {
    let rows = await dbQuery.rawQuery(
        constants.vals.defaultDB,
        `SELECT o.*, u.user_Name, p.product_name 
         FROM offers o 
         LEFT JOIN users u ON o.user_Id=u.user_id
         LEFT JOIN products p ON o.product_Id=p.product_id
         ORDER BY offer_id DESC`
    );

    return utility.apiResponse(req, res, { status: "success", msg: "Offers fetched", data: rows });
};


// delete offer
exports.deleteOffer = async (req, res) => {
    let id = req.body.inputdata.offer_id;

    if (!id) return utility.apiResponse(req, res, { status: "error", msg: "Offer ID required." });

    await dbQuery.updateRecord(
        constants.vals.defaultDB,
        "offers",
        `offer_id=${id}`,
        { deleted_at: req.locals.now }
    );

    return utility.apiResponse(req, res, { status: "success", msg: "Offer deleted" });
};



function makeSlug(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");
}



async function updateUserWalletBalance(userId) {
    let row = await dbQuery.rawQuery(
        constants.vals.defaultDB,
        `SELECT 
            SUM(CASE WHEN type='add' THEN amount ELSE 0 END) -
            SUM(CASE WHEN type='withdraw' THEN amount ELSE 0 END) AS total
         FROM user_wallets 
         WHERE user_id=${userId} AND status='completed'`
    );

    let total = parseFloat(row[0]?.total || 0);

    await dbQuery.rawQuery(
        constants.vals.defaultDB,
        `UPDATE users SET user_Wallet_Amount=${total} WHERE user_id=${userId}`
    );

    return total;
}
exports.getAllOrders = async (req, res) => {
    try {
        let admin = req.userInfo;
        let body = req.body.inputdata || {};

        let where = "WHERE 1=1";

        // Optional filters
        if (body.order_status) {
            where += ` AND o.order_status='${body.order_status}'`;
        }

        if (body.payment_mode) {
            where += ` AND o.payment_mode='${body.payment_mode}'`;
        }

        let sql = `
            SELECT 
                o.order_id,
                o.total_amount,
                o.order_status,
                o.admin_status,
                o.payment_mode,
                o.created_at,
                u.user_Name,
                u.user_Mobile
            FROM user_orders o
            JOIN users u ON u.user_id = o.user_id
            ${where}
            ORDER BY o.order_id DESC
        `;

        let orders = await dbQuery.rawQuery(constants.vals.defaultDB, sql);

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Admin order list fetched.",
            data: { orders }
        });

    } catch (err) {
        console.error(err);
        throw err;
    }
};
// ADMIN ORDER DETAILS
exports.getOrderDetails = async (req, res) => {
  try {
    let { order_id } = req.body.inputdata;

    if (!order_id) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Order ID required."
      });
    }

    // ORDER + USER
    const order = await dbQuery.fetchSingleRecord(
      constants.vals.defaultDB,
      `
      user_orders o
      JOIN users u ON u.user_id=o.user_id
      `,
      `WHERE o.order_id=${order_id}`,
      `
      o.*,
      u.user_Name,
      u.user_Mobile
      `
    );

    if (!order) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Order not found"
      });
    }

    // ITEMS + PRODUCT + VARIATION
    const items = await dbQuery.rawQuery(
      constants.vals.defaultDB,
      `
      SELECT
        c.product_Id,
        c.variation_id,

        p.product_name,

        v.sku,
        v.price,
        v.sale_price,

        c.product_Quantity,
        c.product_Total_Amount,

        (
          SELECT imageUrl 
          FROM product_images 
          WHERE product_id=p.product_id 
          LIMIT 1
        ) AS product_image
      FROM user_carts c
      JOIN products p ON p.product_id=c.product_Id
      LEFT JOIN product_variations v ON v.variation_id=c.variation_id
      WHERE c.order_id=${order_id}
      `
    );

    // ADDRESS
    let address = null;
    if (order.address) {
      address = await dbQuery.fetchSingleRecord(
        constants.vals.defaultDB,
        "user_addresses",
        `WHERE address_id=${order.address}`,
        "*"
      );
    }

    return utility.apiResponse(req, res, {
      status: "success",
      msg: "Order details fetched",
      data: { order, items, address }
    });

  } catch (err) {
    console.error(err);
    throw err;
  }
};





// ADMIN ACCEPT ORDER

exports.acceptOrder = async (req, res) => {
  try {
    let { order_id } = req.body.inputdata;

    const order = await dbQuery.fetchSingleRecord(
      constants.vals.defaultDB,
      "user_orders o JOIN users u ON o.user_id=u.user_id",
      `WHERE o.order_id=${order_id} AND o.order_status='pending'`,
      "o.*, u.user_Name, u.user_Mobile"
    );

    if (!order) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Order cannot be accepted."
      });
    }

    const invoiceNumber = `INV-${Date.now()}`;

    // Fetch variation-based items
    const items = await dbQuery.rawQuery(
      constants.vals.defaultDB,
      `
      SELECT 
        c.product_Quantity,
        c.product_Total_Amount,
        v.variation_name,
        v.sku
      FROM user_carts c
      JOIN product_variations v ON c.variation_id=v.variation_id
      WHERE c.order_id=${order_id}
      `
    );

    const address = await dbQuery.fetchSingleRecord(
      constants.vals.defaultDB,
      "user_addresses",
      `WHERE address_id=${order.address}`,
      "*"
    );

    // Generate PDF
    const invoiceFile = await generateInvoicePDF(
      { ...order, invoice_number: invoiceNumber },
      items,
      address
    );

    // Update order
    await dbQuery.updateRecord(
      constants.vals.defaultDB,
      "user_orders",
      `order_id=${order_id}`,
      `
      admin_status='accepted',
      order_status='accepted',
      invoice_number='${invoiceNumber}',
      invoice_file='${invoiceFile}',
      updated_at='${req.locals.now}'
      `
    );

    return utility.apiResponse(req, res, {
      status: "success",
      msg: "Order accepted & invoice generated.",
      data: {
        invoice_number: invoiceNumber,
        invoice_file: invoiceFile
      }
    });

  } catch (err) {
    console.error("Accept Order Error:", err);
    throw err;
  }
};



exports.rejectOrder = async (req, res) => {
  try {
    let { order_id, reason } = req.body.inputdata;

    const order = await dbQuery.fetchSingleRecord(
      constants.vals.defaultDB,
      "user_orders",
      `WHERE order_id=${order_id}`,
      "order_status"
    );

    if (!order || order.order_status !== "pending") {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Order cannot be rejected."
      });
    }

    await dbQuery.updateRecord(
      constants.vals.defaultDB,
      "user_orders",
      `order_id=${order_id}`,
      `
      admin_status='rejected',
      order_status='rejected',
      cancel_reason='${reason}',
      updated_at='${req.locals.now}'
      `
    );

    return utility.apiResponse(req, res, {
      status: "success",
      msg: "Order rejected."
    });

  } catch (err) {
    throw err;
  }
};



exports.adminMarkPickup = async (req, res) => {
  try {
    let { order_id } = req.body.inputdata;

    await dbQuery.updateRecord(
      constants.vals.defaultDB,
      "user_orders",
      `order_id=${order_id} AND order_status='accepted'`,
      `
      order_status='pickup',
      pickup_at='${req.locals.now}',
      updated_at='${req.locals.now}'
      `
    );

    return utility.apiResponse(req, res, {
      status: "success",
      msg: "Order marked as pickup."
    });

  } catch (err) {
    throw err;
  }
};



// ADMIN GENERATE INVOICE NUMBER

const generateInvoicePDF = async (order, items, address) => {
  return new Promise((resolve, reject) => {
    try {
      const fileName = `invoice_${order.invoice_number}.pdf`;
      const dirPath = path.join(__dirname, "../Assets/uploads/invoices");

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const filePath = path.join(dirPath, fileName);

      const doc = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // HEADER
      doc.fontSize(18).text("INVOICE", { align: "center" });
      doc.moveDown();

      doc.fontSize(11);
      doc.text(`Invoice No: ${order.invoice_number}`);
      doc.text(`Order ID: ${order.order_id}`);
      doc.text(`Date: ${order.created_at}`);
      doc.moveDown();

      // CUSTOMER
      doc.text(`Customer: ${order.user_Name}`);
      doc.text(`Mobile: ${order.user_Mobile}`);
      doc.moveDown();

      // ADDRESS
      if (address) {
        doc.text("Delivery Address:");
        doc.text(address.address);
        doc.text(`${address.city}, ${address.state} - ${address.pincode}`);
        doc.moveDown();
      }

      // ITEMS
      doc.fontSize(12).text("Items:");
      doc.moveDown();

      items.forEach(item => {
        doc.text(
          `${item.variation_name} (${item.sku}) × ${item.product_Quantity} = ₹${item.product_Total_Amount}`
        );
      });

      doc.moveDown();
      doc.fontSize(13).text(`Total Amount: ₹${order.total_amount}`, {
        align: "right"
      });

      doc.end();

      stream.on("finish", () => resolve(fileName));
      stream.on("error", err => reject(err));

    } catch (err) {
      reject(err);
    }
  });
};



exports.downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const order = await dbQuery.fetchSingleRecord(
      constants.vals.defaultDB,
      "user_orders",
      `WHERE order_id=${orderId}`,
      "invoice_file, order_status"
    );

    if (!order || !order.invoice_file) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Invoice not available."
      });
    }

    if (!["accepted", "pickup", "delivered"].includes(order.order_status)) {
      return utility.apiResponse(req, res, {
        status: "error",
        msg: "Invoice not allowed."
      });
    }

    const filePath = path.join(
      __dirname,
      "../Assets/uploads/invoices",
      order.invoice_file
    );

    return res.download(filePath);

  } catch (err) {
    console.error("Download Invoice Error:", err);
    throw err;
  }
};



