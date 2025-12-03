const dbQuery = require("../helpers/query");
let constants = require("../vars/constants");
const utility = require('../helpers/utility');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require("fs");
const path = require("path");
const configPath = path.join(__dirname, "../config/smsConfig.json");




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
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let admin = req?.userInfo;

        // ========================= VALIDATION =========================
        let messages = {
            product_name: "Product name is required.",
            category_id: "Category is required.",
            sub_category_id: "Sub category is required.",
            product_base_price: "Base price is required.",
            product_sale_price: "Sale price is required.",
            available_quantity: "Available quantity is required."
        };

        for (let key in messages) {
            if (!body[key] && body[key] !== 0) {
                response.msg = messages[key];
                return utility.apiResponse(req, res, response);
            }
        }

        // ========================= CHECK CATEGORY =========================
        let category = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "categories",
            `WHERE category_id=${body.category_id} AND is_delete=0`,
            "category_id, admin_Id"
        );

        if (!category) {
            response.msg = "Invalid category!";
            return utility.apiResponse(req, res, response);
        }

        if (admin.admin_Type === "admin" && category.admin_Id !== admin.admin_Id) {
            response.msg = "You cannot add product in this category.";
            return utility.apiResponse(req, res, response);
        }

        // ========================= CHECK SUB CATEGORY =========================
        let subCat = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "sub_categories",
            `WHERE sub_category_id=${body.sub_category_id} AND is_delete=0`,
            "sub_category_id, admin_Id"
        );

        if (!subCat) {
            response.msg = "Invalid sub category!";
            return utility.apiResponse(req, res, response);
        }

        if (admin.admin_Type === "admin" && subCat.admin_Id !== admin.admin_Id) {
            response.msg = "You cannot add product in this sub category.";
            return utility.apiResponse(req, res, response);
        }

        // ========================= DUPLICATE CHECK =========================
        let dupCheck = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "products",
            `WHERE product_name='${body.product_name}' AND admin_id=${admin.admin_Id} AND status = 1`,
            "product_id"
        );

        if (Array.isArray(dupCheck) && dupCheck.length > 0) {
            response.msg = "Product already exists.";
            return utility.apiResponse(req, res, response);
        }

        // ========================= INSERT PRODUCT =========================
        const slug = makeSlug(body.product_name);

        const params = {
            category_id: body.category_id,
            sub_category_id: body.sub_category_id,
            admin_id: admin.admin_Id,
            product_name: body.product_name,
            product_slug: slug,
            product_description: body?.product_description || "",
            product_base_price: body.product_base_price,
            product_sale_price: body.product_sale_price,
            available_quantity: body.available_quantity,   // 👈 NEW FIELD
            product_tags: body?.product_tags || "",
            created_at: req.locals.now
        };

        const productId = await dbQuery.insertSingle(
            constants.vals.defaultDB,
            "products",
            params
        );

        // ========================= IMAGES =========================
        if (Array.isArray(body.product_images)) {
            for (let img of body.product_images) {
                await dbQuery.insertSingle(constants.vals.defaultDB, "product_images", {
                    product_id: productId,
                    imageUrl: img
                });
            }
        }

        // ========================= ATTRIBUTE VALUES =========================
        if (Array.isArray(body.attribute_values)) {
            for (let item of body.attribute_values) {
                for (let valueId of item.value_ids) {
                    await dbQuery.insertSingle(constants.vals.defaultDB, "product_attribute_values", {
                        product_id: productId,
                        attribute_id: item.attribute_id,
                        value_id: valueId
                    });
                }
            }
        }

        response.status = "success";
        response.msg = "Product added successfully.";
        response.data = { product_id: productId };

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};






exports.updateProduct = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let admin = req?.userInfo;

        if (!body.product_id) {
            response.msg = "Product ID is required.";
            return utility.apiResponse(req, res, response);
        }

        let product = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "products",
            `WHERE product_id=${body.product_id}`,
            "product_id, admin_id"
        );

        if (!product || product.length === 0) {
            response.msg = "Product not found.";
            return utility.apiResponse(req, res, response);
        }

        if (admin.admin_Type === "admin" && product.admin_id !== admin.admin_Id) {
            response.msg = "You are not allowed to update this product.";
            return utility.apiResponse(req, res, response);
        }

        const slug = body.product_name ? makeSlug(body.product_name) : product.product_slug;

        let updateFields = [];

        for (let key in body) {
            if (key !== "product_id") {
                updateFields.push(`${key}='${body[key]}'`);
            }
        }

        updateFields.push(`product_slug='${slug}'`);
        updateFields.push(`updated_at='${req.locals.now}'`);

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "products",
            `product_id=${body.product_id}`,
            updateFields.join(",")
        );

        response.status = "success";
        response.msg = "Product updated successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;
        let admin = req?.userInfo;

        if (!body.product_id) {
            response.msg = "Product ID is required.";
            return utility.apiResponse(req, res, response);
        }

        let product = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "products",
            `WHERE product_id=${body.product_id}`,
            "product_id, admin_id"
        );

        if (!product || product.length === 0) {
            response.msg = "Product not found.";
            return utility.apiResponse(req, res, response);
        }

        if (admin.admin_Type === "admin" && product.admin_id !== admin.admin_Id) {
            response.msg = "You are not allowed to delete this product.";
            return utility.apiResponse(req, res, response);
        }

        const updateValue = `
            status = 0,
            updated_at='${req.locals.now}'
        `;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "products",
            `product_id=${body.product_id}`,
            updateValue
        );

        response.status = "success";
        response.msg = "Product deleted successfully.";
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};



exports.getProductDetails = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;

        if (!body.product_id) {
            response.msg = "Product ID is required.";
            return utility.apiResponse(req, res, response);
        }

        let product = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "products",
            `WHERE product_id=${body.product_id}`,
            "*"
        );

        if (!product || product.length === 0) {
            response.msg = "Product not found.";
            return utility.apiResponse(req, res, response);
        }

        let images = await dbQuery.fetchRecords(
            constants.vals.defaultDB,
            "product_images",
            `WHERE product_id=${body.product_id}`,
            "product_image_id, imageUrl"
        );

        product.images = images;

        response.status = "success";
        response.msg = "Product fetched successfully.";
        response.data = product;
        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};


exports.listProduct = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata || {};
        let admin = req?.userInfo;

        let page = parseInt(body.page) || 1;
        let limit = parseInt(body.limit) || 10;
        let offset = (page - 1) * limit;

        let where = `WHERE p.status = 1`;

        if (admin.admin_Type === "admin") {
            where += ` AND p.admin_id=${admin.admin_Id}`;
        }

        if (body.category_id) {
            where += ` AND p.category_id=${body.category_id}`;
        }

        if (body.sub_category_id) {
            where += ` AND p.sub_category_id=${body.sub_category_id}`;
        }

        // ⭐ FINAL QUERY INCLUDING available_quantity
        const sql = `
            SELECT 
                p.product_id,
                p.product_name,
                p.product_slug,
                p.product_description,
                p.product_base_price,
                p.product_sale_price,
                p.available_quantity,
                p.product_tags,
                p.product_review,
                p.created_at,
                c.category_Name,
                sc.sub_Category_Name,

                -- ⭐ GROUP ATTRIBUTES
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'attribute_id', pav.attribute_id,
                        'attribute_name', att.name,
                        'values',
                        (
                            SELECT JSON_ARRAYAGG(val.value)
                            FROM product_attribute_values pav2
                            JOIN attribute_values val ON pav2.value_id = val.value_id
                            WHERE pav2.product_id = p.product_id
                            AND pav2.attribute_id = pav.attribute_id
                        )
                    )
                ) AS product_attributes

            FROM products AS p
            LEFT JOIN categories AS c ON p.category_id = c.category_id
            LEFT JOIN sub_categories AS sc ON p.sub_category_id = sc.sub_category_id
            LEFT JOIN product_attribute_values pav ON pav.product_id = p.product_id
            LEFT JOIN attributes att ON att.attribute_id = pav.attribute_id

            ${where}
            GROUP BY p.product_id
            ORDER BY p.product_id DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        let list = await dbQuery.rawQuery(constants.vals.defaultDB, sql);

        // ⭐ ADD REVIEW SUMMARY FOR EACH PRODUCT
        for (let p of list) {
            const reviewSummary = await dbQuery.rawQuery(
                constants.vals.defaultDB,
                `
                SELECT 
                    AVG(review) AS avg_rating,
                    COUNT(*) AS total_reviews
                FROM product_reviews
                WHERE product_id = ${p.product_id}
                `
            );

            p.review_summary = {
                avg_rating: parseFloat(reviewSummary[0]?.avg_rating || 0).toFixed(1),
                total_reviews: reviewSummary[0]?.total_reviews || 0
            };
        }

        // ⭐ COUNT QUERY
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM products AS p
            ${where}
        `;

        const countData = await dbQuery.rawQuery(constants.vals.defaultDB, countQuery);

        response.status = "success";
        response.msg = "Product list fetched.";
        response.data = {
            list,
            pagination: {
                page,
                limit,
                total: countData[0]?.total || 0
            }
        };

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};






exports.uploadProductImages = async (req, res) => {
  try {
    let response = { status: "error", msg: "" };
    let body = req?.body?.inputdata;
    let admin = req?.userInfo;

    console.log(body);

    if (!body?.product_id) {
      response.msg = "Product ID is required.";
      return utility.apiResponse(req, res, response);
    }

    if (!Array.isArray(body?.product_images) || body.product_images.length === 0) {
      response.msg = "Product images are required.";
      return utility.apiResponse(req, res, response);
    }

    for (let img of body.product_images) {
      await dbQuery.insertSingle(constants.vals.defaultDB, "product_images", {
        product_id: body.product_id,
        imageUrl: img
      });
    }

    response.status = "success";
    response.msg = "Product images uploaded successfully.";
    return utility.apiResponse(req, res, response);

  } catch (err) { throw err; }
};



exports.deleteProductImage = async (req, res) => {
    try {
        let { product_image_id } = req.body.inputdata;

        let check = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "product_images",
            `WHERE product_image_id=${product_image_id}`,
            "product_image_id"
        );

        if (!check) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Image not found."
            });
        }

        await dbQuery.deleteRecord(constants.vals.defaultDB, "product_images", `product_image_id=${product_image_id}`);

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










// Add patrol unit
exports.addPatrolUnit = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;

        let messages = {
            patrol_unit_Name: 'Patrol unit name is required.',
            police_station_Id: 'Police station is required.'
        }

        if (bodyData?.is_District) {
            delete messages.police_station_Id;
        }

        for (key in messages) {
            if (utility.checkEmptyString(bodyData[key])) {
                response['msg'] = messages[key];
                return utility.apiResponse(req, res, response);
            }
        }

        const params = {
            patrol_unit_Name: bodyData?.patrol_unit_Name,
            police_station_Id: bodyData?.police_station_Id,
            patrol_unit_Latitude: bodyData?.patrol_unit_Latitude,
            patrol_unit_Longitude: bodyData?.patrol_unit_Longitude,
            patrol_unit_District: bodyData?.patrol_unit_District,
            is_District: bodyData?.is_District ? 1 : 0,
            created_at: req.locals.now
        }

        if (bodyData?.is_District) {

            let condition = `WHERE police_station_District = '${bodyData?.patrol_unit_District}' AND is_District = 1 AND is_active = 1 AND is_delete = 0`;
            let selectFields = 'police_station_Id';

            const getPoliceStation = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'police_station', condition, selectFields);

            params.police_station_Id = getPoliceStation?.police_station_Id;
        }

        const userId = await dbQuery.insertSingle(constants.vals.defaultDB, 'patrol_unit', params);

        if (userId) {
            response['status'] = 'success';
            response['msg'] = 'Patrol unit has been added successfully.';
            return utility.apiResponse(req, res, response);
        } else {
            response['status'] = 'error';
            response['msg'] = 'There is some error while adding patrol unit data.';
            return utility.apiResponse(req, res, response);
        }

    } catch (error) {
        throw error;
    }
}

// Add Admin station
exports.addPoliceStation = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;

        let messages = {
            police_station_Name: 'Police station name is required.',
            police_station_Area: 'Police station area is required.',
            selected_District: 'District is required.',
            police_station_latitude: 'Patrol station latitude is required.',
            police_station_longitude: 'Police station longitude is required.',
            police_station_phone: 'Police station phone number is required.'
        }

        for (key in bodyData) {
            if (utility.checkEmptyString(bodyData[key])) {
                response['msg'] = messages[key];
                return utility.apiResponse(req, res, response);
            }
        }

        const params = {
            police_station_Name: bodyData?.police_station_Name,
            police_station_Area: bodyData?.police_station_Area,
            police_station_District: bodyData?.selected_District,
            police_station_latitude: bodyData?.police_station_latitude,
            police_station_longitude: bodyData?.police_station_longitude,
            is_District: bodyData?.is_District ? 1 : 0,
            police_station_phone: bodyData?.police_station_phone,
            created_at: req.locals.now,
        }

        const userId = await dbQuery.insertSingle(constants.vals.defaultDB, 'police_station', params);

        if (userId) {
            response['status'] = 'success';
            response['msg'] = 'Police station has been added successfully.';
            return utility.apiResponse(req, res, response);
        } else {
            response['status'] = 'error';
            response['msg'] = 'There is some error while adding police station data.';
            return utility.apiResponse(req, res, response);
        }

    } catch (error) {
        throw error;
    }
}

// District police station list
exports.districtPoliceStationList = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';

        let policeStationCondition = `WHERE is_District = 1 AND is_delete = 0 ORDER BY created_at DESC`;
        let policeStationFields = 'police_station_Id, police_station_Name, police_station_Area, police_station_District, police_station_Latitude, police_station_Longitude, is_District, police_station_phone, is_active';

        const policeStationData = await dbQuery.fetchRecords(constants.vals.defaultDB, 'police_station', policeStationCondition, policeStationFields);

        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        response['data'] = policeStationData;
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}

// Patrol unit list
exports.patrolUnitList = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';

        let patrolUnitCondition = `WHERE is_delete = 0 ORDER BY created_at DESC`;
        let patrolUnitFields = 'patrol_unit_Id, patrol_unit_Name, police_station_Id, patrol_unit_District, patrol_unit_Latitude, patrol_unit_Longitude, is_active';

        const patrolUnitData = await dbQuery.fetchRecords(constants.vals.defaultDB, 'patrol_unit', patrolUnitCondition, patrolUnitFields);

        if (patrolUnitData.length > 0) {

            for (let data of patrolUnitData) {
                let condition = `WHERE police_station_Id = ${data?.police_station_Id} AND is_active = 1 AND is_delete = 0`;
                let selectFields = 'police_station_Name, is_District';

                const getPoliceStation = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'police_station', condition, selectFields);

                data.police_station = getPoliceStation?.police_station_Name || "";
                data.is_District = getPoliceStation?.is_District;
            }
        }

        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        response['data'] = patrolUnitData;
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}

// Police officer list
exports.policeOfficerList = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';

        let policeOfficerCondition = `WHERE is_delete = 0 ORDER BY created_at DESC`;
        let policeOfficerFields = 'police_officer_Id , police_officer_Name, police_officer_BadgeNumber , police_officer_Rank, police_officer_Role, police_officer_Phone, police_station_Id, patrol_unit_Id, police_officer_profile_Picture, is_active';

        const policeOfficerData = await dbQuery.fetchRecords(constants.vals.defaultDB, 'police_officer', policeOfficerCondition, policeOfficerFields);

        if (policeOfficerData.length > 0) {

            for (let data of policeOfficerData) {

                let condition = `WHERE police_station_Id = ${data?.police_station_Id} AND is_active = 1 AND is_delete = 0`;
                let selectFields = 'police_station_Name';

                const getPoliceStation = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'police_station', condition, selectFields);

                data.police_station = getPoliceStation.police_station_Name || "";

                let patrolUnitCondition = `WHERE patrol_unit_Id = ${data?.patrol_unit_Id} AND is_active = 1 AND is_delete = 0`;
                let patrolUnitFields = 'patrol_unit_Name';

                const patrolUnitData = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'patrol_unit', patrolUnitCondition, patrolUnitFields);

                data.patrol_unit = patrolUnitData.patrol_unit_Name || "";

                if (data.police_officer_profile_Picture && data.police_officer_profile_Picture !== null) {
                    data.police_officer_profile_Picture = constants.vals.frontEndUserProfilePath + data.police_officer_profile_Picture;
                }
            }
        }

        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        response['data'] = policeOfficerData;
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}

// View police officer by id
exports.policeOfficerView = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;

        let condition = `WHERE police_officer_Id = ${bodyData?.police_officer_Id} AND is_active = 1 AND is_delete = 0`;
        let selectFields = 'police_officer_Name, police_officer_BadgeNumber , police_officer_Rank, police_officer_Role, police_officer_Phone, police_station_Id, patrol_unit_Id, is_active';

        const checkPoliceOfficer = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'police_officer', condition, selectFields);

        if (Array.isArray(checkPoliceOfficer) && checkPoliceOfficer.length == 0) {
            response['status'] = 'error';
            response['msg'] = 'Police officer is not available in our system.';
            return utility.apiResponse(req, res, response);
        } else {

            let policeStationCondition = `WHERE police_station_Id = ${checkPoliceOfficer?.police_station_Id} AND is_active = 1 AND is_delete = 0`;
            let policeStationFields = 'police_station_Name, is_District';

            const policeStationData = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'police_station', policeStationCondition, policeStationFields);

            checkPoliceOfficer.police_station = policeStationData?.police_station_Name || "";
            checkPoliceOfficer.is_District = policeStationData?.is_District;

            let patrolUnitCondition = `WHERE patrol_unit_Id = ${checkPoliceOfficer?.patrol_unit_Id} AND is_active = 1 AND is_delete = 0`;
            let parolUnitFields = 'patrol_unit_Name';

            const patrolUnitData = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'patrol_unit', patrolUnitCondition, parolUnitFields);

            checkPoliceOfficer.patrol_unit = patrolUnitData?.patrol_unit_Name || "";

            response['status'] = 'success';
            response['msg'] = 'Request has been completed successfully.';
            response['data'] = checkPoliceOfficer;
            return utility.apiResponse(req, res, response);
        }

    } catch (error) {
        throw error;
    }
}




// Edit patrol unit
exports.editPatrolUnit = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;

        let messages = {
            patrol_unit_Name: 'Patrol unit name is required.',
            police_station_Id: 'Police station is required.'
        }

        for (key in bodyData) {
            if (utility.checkEmptyString(bodyData[key])) {
                response['msg'] = messages[key];
                return utility.apiResponse(req, res, response);
            }
        }

        let condition = `WHERE patrol_unit_Id = ${bodyData?.patrol_unit_Id} AND is_active = 1 AND is_delete = 0`;
        let selectFields = 'patrol_unit_Id';

        const checkPatrolUnit = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'patrol_unit', condition, selectFields);

        if (Array.isArray(checkPatrolUnit) && checkPatrolUnit.length == 0) {
            response['status'] = 'error';
            response['msg'] = 'Patrol unit is not available in our system.';
            return utility.apiResponse(req, res, response);
        } else {

            const date = req.locals.now;
            const newValue = `patrol_unit_Name = '${bodyData?.patrol_unit_Name}', police_station_Id = ${bodyData?.police_station_Id}, patrol_unit_District = '${bodyData?.patrol_unit_District}', patrol_unit_Latitude = ${bodyData?.patrol_unit_Latitude}, patrol_unit_Longitude = ${bodyData?.patrol_unit_Longitude}, updated_at = '${date}'`;
            const condition = `patrol_unit_Id = ${bodyData?.patrol_unit_Id}`;

            await dbQuery.updateRecord(constants.vals.defaultDB, 'patrol_unit', condition, newValue);

            response['status'] = 'success';
            response['msg'] = 'Patrol unit has been updated successfully.';
            return utility.apiResponse(req, res, response);
        }

    } catch (error) {
        throw error;
    }
}

// Edit police station
exports.editPoliceStation = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;

        let messages = {
            police_station_Name: 'Police station name is required.',
            police_station_Area: 'Police station area is required.',
            selected_District: 'District is required.',
            police_station_latitude: 'Patrol station latitude is required.',
            police_station_longitude: 'Police station longitude is required.'
        }

        for (key in bodyData) {
            if (utility.checkEmptyString(bodyData[key])) {
                response['msg'] = messages[key];
                return utility.apiResponse(req, res, response);
            }
        }

        let condition = `WHERE police_station_Id = ${bodyData?.police_station_Id} AND is_active = 1 AND is_delete = 0`;
        let selectFields = 'police_station_Id';

        const checkPoliceStation = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'police_station', condition, selectFields);

        if (Array.isArray(checkPoliceStation) && checkPoliceStation.length == 0) {
            response['status'] = 'error';
            response['msg'] = 'Police Station is not available in our system.';
            return utility.apiResponse(req, res, response);
        } else {

            const date = req.locals.now;
            const newValue = `police_station_Name = '${bodyData?.police_station_Name}', police_station_Area = '${bodyData?.police_station_Area}', police_station_District = '${bodyData?.selected_District}', police_station_latitude = ${bodyData?.police_station_latitude}, police_station_longitude = ${bodyData?.police_station_longitude}, police_station_phone = ${bodyData?.police_station_phone}, is_District = ${bodyData?.is_District ? 1 : 0}, updated_at = '${date}'`;
            const condition = `police_station_Id = ${bodyData?.police_station_Id}`;

            await dbQuery.updateRecord(constants.vals.defaultDB, 'police_station', condition, newValue);

            response['status'] = 'success';
            response['msg'] = 'Police station has been updated successfully.';
            return utility.apiResponse(req, res, response);
        }

    } catch (error) {
        throw error;
    }
}


// Get police request list
exports.policeRequestList = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;
        let itemsPerPage = bodyData?.items_per_page || 10;
        let currentPage = bodyData?.current_page || 1;
        const offset = (currentPage - 1) * itemsPerPage;

        let policeRequestCondition = "";

        if (!utility.checkEmptyString(bodyData['date_from']) && !utility.checkEmptyString(bodyData['date_to'])) {
            if (bodyData?.police_request_Status === 'Accepted') {
                policeRequestCondition = `AND (pr.police_request_Status = '${bodyData?.police_request_Status}' OR pr.police_request_Status = 'Pending Report') AND DATE(pr.created_at) >= '${bodyData?.date_from}' AND DATE(pr.created_at) <= '${bodyData?.date_to}'`;
            } else {
                policeRequestCondition = `AND pr.police_request_Status = '${bodyData?.police_request_Status}' AND DATE(pr.created_at) >= '${bodyData?.date_from}' AND DATE(pr.created_at) <= '${bodyData?.date_to}'`;
            }
        } else {
            if (bodyData?.police_request_Status === 'Accepted') {
                policeRequestCondition = `AND (pr.police_request_Status = '${bodyData?.police_request_Status}' OR pr.police_request_Status = 'Pending Report')`;
            } else {
                policeRequestCondition = `AND pr.police_request_Status = '${bodyData?.police_request_Status}'`;
            }
        }

        const requestsData = await dbQuery.getPoliceRequestListForAdmin(constants.vals.defaultDB, policeRequestCondition, itemsPerPage, offset);

        if (requestsData.length > 0) {
            for (let data of requestsData) {
                let condition = `WHERE police_request_Id = ${data?.police_request_Id}`;
                let selectFields = 'crime_report_Id';

                if (data?.camera_Id) {
                    let cameraFields = 'camera_info_Id, camera_Id, camera_Name, camera_info_event_Id, camera_info_Latitude, camera_info_Longitude';
                    let cameraCondition = `WHERE camera_info_Id = ${data?.camera_Id}`;

                    const cameraData = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'camera_info', cameraCondition, cameraFields);

                    data.cameraDetail = cameraData;
                }

                const getCrimeReport = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'crime_report', condition, selectFields);

                if (Array.isArray(getCrimeReport) && getCrimeReport.length == 0) {
                    data.prank_call = false;
                } else {
                    data.prank_call = true;
                }
            }
        }

        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        response['data'] = requestsData;
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}

// Delete police station
exports.deletePoliceStation = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;

        let condition = `WHERE police_station_Id = ${bodyData?.police_station_Id} AND is_active = 1 AND is_delete = 0`;
        let selectFields = 'police_station_Id';

        const checkPoliceStation = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'police_station', condition, selectFields);

        if (Array.isArray(checkPoliceStation) && checkPoliceStation.length == 0) {
            response['status'] = 'error';
            response['msg'] = 'Police Station is not available in our system.';
            return utility.apiResponse(req, res, response);
        } else {
            let condition = `WHERE police_station_Id = ${bodyData?.police_station_Id} AND is_active = 1 AND is_delete = 0`;
            let selectFields = 'patrol_unit_Id';

            const checkPatrolUnit = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'patrol_unit', condition, selectFields);

            if (Array.isArray(checkPatrolUnit) && checkPatrolUnit.length == 0) {
                const date = req.locals.now;
                const newValue = `is_delete = 1, deleted_at = '${date}'`;
                const condition = `police_station_Id = ${bodyData?.police_station_Id}`;

                await dbQuery.updateRecord(constants.vals.defaultDB, 'police_station', condition, newValue);

                response['status'] = 'success';
                response['msg'] = 'Police station has been deleted successfully.';
                return utility.apiResponse(req, res, response);
            } else {
                response['status'] = 'error';
                response['msg'] = 'This police station cannot be deleted as it has patrol units.';
                return utility.apiResponse(req, res, response);
            }
        }

    } catch (error) {
        throw error;
    }
}

// Delete patrol unit
exports.deletePatrolUnit = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;

        let condition = `WHERE patrol_unit_Id = ${bodyData?.patrol_unit_Id} AND is_active = 1 AND is_delete = 0`;
        let selectFields = 'patrol_unit_Id';

        const checkPatrolUnit = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'patrol_unit', condition, selectFields);

        if (Array.isArray(checkPatrolUnit) && checkPatrolUnit.length == 0) {
            response['status'] = 'error';
            response['msg'] = 'Patrol unit is not available in our system.';
            return utility.apiResponse(req, res, response);
        } else {
            let condition = `WHERE patrol_unit_Id = ${bodyData?.patrol_unit_Id} AND is_active = 1 AND is_delete = 0`;
            let selectFields = 'police_officer_Id';

            const checkPoliceRequest = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'police_officer', condition, selectFields);

            if (Array.isArray(checkPoliceRequest) && checkPoliceRequest.length == 0) {
                let condition = `WHERE assigned_patrol_Id = ${bodyData?.patrol_unit_Id} AND police_request_Status = 'Accepted' AND is_active = 1 AND is_delete = 0`;
                let selectFields = 'police_request_Id';

                const checkPoliceRequest = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'police_request', condition, selectFields);

                if (Array.isArray(checkPoliceRequest) && checkPoliceRequest.length == 0) {
                    const date = req.locals.now;
                    const newValue = `is_delete = 1, deleted_at = '${date}'`;
                    const condition = `patrol_unit_Id = ${bodyData?.patrol_unit_Id}`;

                    await dbQuery.updateRecord(constants.vals.defaultDB, 'patrol_unit', condition, newValue);

                    response['status'] = 'success';
                    response['msg'] = 'Patrol unit has been deleted successfully.';
                    return utility.apiResponse(req, res, response);
                } else {
                    response['status'] = 'error';
                    response['msg'] = 'This patrol unit cannot be deleted as it has accepted police request.';
                    return utility.apiResponse(req, res, response);
                }
            } else {
                response['status'] = 'error';
                response['msg'] = 'This patrol unit cannot be deleted as it has assigned to police officer.';
                return utility.apiResponse(req, res, response);
            }
        }

    } catch (error) {
        throw error;
    }
}




// Get today's incidents
exports.todayPoliceRequestList = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;

        let policeRequestCondition = `WHERE DATE(created_at) = '${bodyData.date}' AND is_active = 1 AND is_delete = 0 ORDER BY created_at DESC`;
        let policeRequestFields = 'police_request_Id, user_Id, police_request_Type, police_request_Reason, police_request_Latitude, police_request_Longitude, police_request_Status, assigned_patrol_Id, created_at, camera_Id';

        const policeRequestData = await dbQuery.fetchRecords(constants.vals.defaultDB, 'police_request', policeRequestCondition, policeRequestFields);

        if (policeRequestData.length > 0) {
            for (let data of policeRequestData) {

                let userCondition = `WHERE user_Id = ${data?.user_Id}`;
                let userFields = 'user_Name, user_Gender, user_business_Name';
                const userData = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'user', userCondition, userFields);
                data.user = userData;

                if (data?.camera_Id) {
                    let cameraFields = 'camera_info_Id, camera_Id, camera_Name, camera_info_event_Id, camera_info_Latitude, camera_info_Longitude';
                    let cameraCondition = `WHERE camera_info_Id = ${data?.camera_Id}`;

                    const cameraData = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'camera_info', cameraCondition, cameraFields);

                    data.cameraDetail = cameraData;
                }

                if (data.assigned_patrol_Id !== null) {
                    let patrolUnitCondition = `WHERE patrol_unit_Id = ${data?.assigned_patrol_Id}`;
                    let patrolUnitFields = 'patrol_unit_Name';
                    const patrolUnitData = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'patrol_unit', patrolUnitCondition, patrolUnitFields);
                    data.patrol_unit = patrolUnitData;
                }
            }
        }

        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        response['data'] = policeRequestData;
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}
// Patrol unit list by police station id
exports.patrolUnitListByPoliceStation = async (req, res) => {
    try {

        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req.body.inputdata;

        let patrolUnitCondition = `WHERE police_station_Id = ${bodyData?.police_station_Id} AND is_active = 1 AND is_delete = 0`;
        let patrolUnitFields = 'patrol_unit_Id, patrol_unit_Name';

        const patrolUnitData = await dbQuery.fetchRecords(constants.vals.defaultDB, 'patrol_unit', patrolUnitCondition, patrolUnitFields);

        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        response['data'] = patrolUnitData;
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}

// Get sms payload
exports.smsPayload = async (req, res) => {
    try {

        const configData = fs.readFileSync(configPath, "utf-8");
        const config = JSON.parse(configData);

        let response = {};
        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        response['data'] = config;

        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}

// Edit sms payload
exports.editSmsPayload = async (req, res) => {
    try {

        let bodyData = req?.body?.inputdata;

        let messages = {
            key: 'Key is required.',
            sender: 'Sender is required.',
            text: 'Text is required.'
        }

        for (item in messages) {
            if (utility.checkEmptyString(bodyData[item])) {
                response['msg'] = messages[item];
                return utility.apiResponse(req, res, response);
            }
        }

        const { key, sender, text } = bodyData;

        const newConfig = { key, sender, text };

        console.log('newConfig', newConfig);

        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

        let response = {};
        response['status'] = 'success111';
        // response['msg'] = 'Request has been completed successfully.';
        response['data'] = newConfig;

        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}