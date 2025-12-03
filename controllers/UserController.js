const bcrypt = require('bcrypt');
const { responseHandler } = require('../helpers/utility');
const dbQuery = require("../helpers/query");
let constants = require("../vars/constants");
let { notFoundResponse } = require("../vars/apiResponse");
const utility = require('../helpers/utility');
const jwt = require('jsonwebtoken');
const FileManager = require("../helpers/file_manager");
const moment = require('moment-timezone');
const { log } = require('console');
const axios = require("axios");
const FIREBASE_API_KEY = "AIzaSyDVPHjZwCXmiMVUps0MucNzYko9a-AGcWQ";

// User phone number verify
exports.userPhoneVerify = async (req, res) => {
    try {
        let response = { status: 'error', msg: '' };
        let bodyData = req?.body?.inputdata;

        if (utility.checkEmptyString(bodyData.user_Mobile)) {
            response.msg = "Mobile number is required.";
            return utility.apiResponse(req, res, response);
        }

        if (!constants.vals.regex.phone_number.test(bodyData.user_Mobile)) {
            response.msg = "Invalid Indian mobile number.";
            return utility.apiResponse(req, res, response);
        }

        // Check if user exists
        let condition = `WHERE user_Mobile = '${bodyData.user_Mobile}' AND is_delete = 0`;
        let userData = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "users",
            condition,
            "user_id, user_Name, user_Mobile"
        );

        if (!userData) {
            response.msg = "User not found.";
            return utility.apiResponse(req, res, response);
        }

        const userId = userData.user_id;

        // Generate OTP
        const otp = await utility.generateOtp(constants.vals.optLength);
        const hashedOtp = await bcrypt.hash(otp, 10);

        // Remove previous OTP
        await dbQuery.deleteRecord(constants.vals.defaultDB, "user_otp", `user_id=${userId}`);

        // Expiry Time
        const nowLocal = moment.tz(req.locals.now, "YYYY-MM-DD HH:mm:ss", constants.vals.tz);
        const expiresAt = nowLocal
            .add(constants.vals.otpExpireMinutes, "minutes")
            .format("YYYY-MM-DD HH:mm:ss");

        await dbQuery.insertSingle(constants.vals.defaultDB, "user_otp", {
            user_id: userId,
            otp_hash: hashedOtp,
            expires_at: expiresAt
        });

        console.log("Login OTP:", otp);

        // ----------------------------------------------------------------
        // ✔ Return OTP also in Postman response
        // ----------------------------------------------------------------
        response.status = "success";
        response.msg = "OTP sent successfully.";
        response.data = { 
            user_id: userId,
            otp: otp     // <-- RETURN OTP HERE
        };

        return utility.apiResponse(req, res, response);

    } catch (err) {
        console.error(err);
        throw err;
    }
};




// otpverify
exports.userOtpVerify = async (req, res) => {
    try {
        let response = { status: 'error', msg: '' };
        let bodyData = req?.body?.inputdata;

        if (!bodyData.user_id) {
            response.msg = "User ID is required.";
            return utility.apiResponse(req, res, response);
        }

        if (!bodyData.otp) {
            response.msg = "OTP is required.";
            return utility.apiResponse(req, res, response);
        }

        // Fetch OTP
        let condition = `WHERE user_id = ${bodyData.user_id} ORDER BY created_at DESC LIMIT 1`;
        let otpData = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "user_otp",
            condition,
            "id, otp_hash, expires_at"
        );

        if (!otpData || otpData.length === 0) {
            response.msg = "OTP not found.";
            return utility.apiResponse(req, res, response);
        }

        // Expiry check
        if (otpData.expires_at < req.locals.now) {
            response.msg = "OTP expired.";
            return utility.apiResponse(req, res, response);
        }

        // OTP match
        const isMatch = await bcrypt.compare(bodyData.otp, otpData.otp_hash);
        if (!isMatch) {
            response.msg = "Invalid OTP.";
            return utility.apiResponse(req, res, response);
        }

        // Fetch user data
        let userData = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "users",
            `WHERE user_id=${bodyData.user_id}`,
            "user_id, user_Name, user_Mobile, user_Ref_Code"
        );

        if (!userData || userData.length === 0) {
            response.msg = "User not found.";
            return utility.apiResponse(req, res, response);
        }

        // Generate JWT Token
        const token = jwt.sign({ user_id: userData.user_id, mobile: userData.user_Mobile }, 'apiservice');

        // Save token in users table
        const updateVal = `
            is_active = 1, 
            user_Token = '${token}',
            updated_at='${req.locals.now}'
        `;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "users",
            `user_id=${bodyData.user_id}`,
            updateVal
        );

        // Delete OTP after success
        await dbQuery.deleteRecord(
            constants.vals.defaultDB,
            "user_otp",
            `id=${otpData.id}`
        );

        // Attach token
        userData.token = token;

        response.status = 'success';
        response.msg = 'OTP verified successfully.';
        response.data = userData;

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};


// Resend Otp

exports.userResendOtp = async (req, res) => {
    try {
        let response = { status: 'error', msg: '' };
        let bodyData = req?.body?.inputdata;

        if (utility.checkEmptyString(bodyData?.user_Mobile)) {
            response.msg = "Mobile number is required.";
            return utility.apiResponse(req, res, response);
        }

        // Validate phone number (Indian format)
        if (!constants.vals.regex.phone_number.test(bodyData.user_Mobile)) {
            response.msg = "Invalid mobile number.";
            return utility.apiResponse(req, res, response);
        }

        // Check user exists
        let condition = `WHERE user_Mobile = '${bodyData.user_Mobile}' AND is_delete = 0`;
        let userData = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "users",
            condition,
            "user_id, user_Name, user_Mobile"
        );

        if (!userData || userData.length === 0) {
            response.msg = "Mobile number not found.";
            return utility.apiResponse(req, res, response);
        }

        const userId = userData.user_id;

        // Generate OTP
        const otp = await utility.generateOtp(constants.vals.optLength);
        const hashedOtp = await bcrypt.hash(otp, 10);

        console.log("OTP:", otp);

        // Delete old OTP
        await dbQuery.deleteRecord(constants.vals.defaultDB, "user_otp", `user_id=${userId}`);

        // Set expiry time
        const nowLocal = moment.tz(req.locals.now, "YYYY-MM-DD HH:mm:ss", constants.vals.tz);
        const expiresAt = nowLocal.add(constants.vals.otpExpireMinutes, "minutes").format("YYYY-MM-DD HH:mm:ss");

        // Insert new OTP
        await dbQuery.insertSingle(constants.vals.defaultDB, "user_otp", {
            user_id: userId,
            otp_hash: hashedOtp,
            expires_at: expiresAt
        });

        // Send SMS
        // await utility.sendSMS(bodyData.user_Mobile, otp);

        response.status = 'success';
        response.msg = "OTP resent successfully.";
        response.data = { user_id: userId, otp: otp  };

        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
};


// User register
exports.userRegister = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req.body.inputdata;

        // Required fields
        if (utility.checkEmptyString(body.user_Name)) {
            response.msg = "User name is required.";
            return utility.apiResponse(req, res, response);
        }
        if (utility.checkEmptyString(body.user_Mobile)) {
            response.msg = "Mobile number is required.";
            return utility.apiResponse(req, res, response);
        }
        if (!constants.vals.regex.phone_number.test(body.user_Mobile)) {
            response.msg = "Invalid Indian mobile number.";
            return utility.apiResponse(req, res, response);
        }

        // Check duplicate mobile
        let exists = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "users",
            `WHERE user_Mobile='${body.user_Mobile}' AND is_delete=0`,
            "user_id"
        );

        if (exists && exists.user_id) {
            response.msg = "Mobile already registered.";
            return utility.apiResponse(req, res, response);
        }

        // Referral logic
        let referredByUserId = null;

        if (body.user_Referred_By) {
            let refUser = await dbQuery.fetchSingleRecord(
                constants.vals.defaultDB,
                "users",
                `WHERE user_Ref_Code='${body.user_Referred_By}'`,
                "user_id"
            );

            if (refUser && refUser.user_id) {
                referredByUserId = refUser.user_id;
            }
        }

        // Generate my referral code
        const myRefCode = "REF" + Math.floor(100000 + Math.random() * 900000);

        // Create user
        let userId = await dbQuery.insertSingle(
            constants.vals.defaultDB,
            "users",
            {
                user_Name: body.user_Name,
                user_Mobile: body.user_Mobile,
                user_Solun_Name: body?.user_Solun_Name || "",
                user_Ref_Code: myRefCode,
                user_Referred_By: referredByUserId,
                user_Wallet_Amount: 0,
                user_Profile_Photo: "",
                is_active: 0,
                created_at: req.locals.now
            }
        );

        // OTP logic
        const otp = await utility.generateOtp(constants.vals.optLength);
        const hashedOtp = await bcrypt.hash(otp, 10);

        await dbQuery.deleteRecord(
            constants.vals.defaultDB,
            "user_otp",
            `user_id=${userId}`
        );

        const nowLocal = moment.tz(
            req.locals.now,
            "YYYY-MM-DD HH:mm:ss",
            constants.vals.tz
        );

        const expiresAt = nowLocal
            .add(constants.vals.otpExpireMinutes, "minutes")
            .format("YYYY-MM-DD HH:mm:ss");

        await dbQuery.insertSingle(constants.vals.defaultDB, "user_otp", {
            user_id: userId,
            otp_hash: hashedOtp,
            expires_at: expiresAt
        });

        console.log("Register OTP:", otp);

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "OTP sent successfully.",
            data: { user_id: userId, my_referral_code: myRefCode, otp: otp  }
        });

    } catch (err) {
        throw err;
    }
};





// User forget pin
exports.userForgetPin = async (req, res) => {
    try {
        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;
        let userInfo = req?.userInfo;

        // Verify password
        if (!bodyData?.passwordVerified) {

            if (utility.checkEmptyString(bodyData.user_Password)) {
                response['msg'] = 'Password is required.';
                return utility.apiResponse(req, res, response);
            }

            const checkPassword = await bcrypt.compare(bodyData?.user_Password, userInfo?.user_Password);

            if (checkPassword) {
                response['status'] = 'success';
                response['msg'] = 'Password has been verified successfully.';
                return utility.apiResponse(req, res, response);
                // return successResponse(res, 'Password has been verified successfully.');
            } else {
                response['msg'] = 'Incorrect password.';
                return utility.apiResponse(req, res, response);
                // return validationErrorResponse(res, 'Incorrect password.');
            }
        }

        // Change pin
        if (bodyData?.passwordVerified) {

            if (utility.checkEmptyString(bodyData.user_Pin)) {
                response['msg'] = 'Pin is required.';
                return utility.apiResponse(req, res, response);
            }

            const checkPassword = await bcrypt.compare(bodyData?.user_Password, userInfo?.user_Password);

            if (!checkPassword) {
                response['msg'] = 'Incorrect password.';
                return utility.apiResponse(req, res, response);
                // return validationErrorResponse(res, 'Incorrect password.');
            }

            const date = req.locals.now;
            const newValue = `user_Pin = '${bodyData?.user_Pin}', updated_at = '${date}'`;

            const condition = `user_Id = ${userInfo?.user_Id}`;

            await dbQuery.updateRecord(constants.vals.defaultDB, 'user', condition, newValue);

            response['status'] = 'success';
            response['msg'] = 'Pin has been changed successfully.';
            return utility.apiResponse(req, res, response);
            // return successResponse(res, 'Pin has been changed successfully.');
        }

    } catch (error) {
        throw error;
    }
}

// User details
exports.getUserDetails = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        const userInfo = req?.userInfo; // set from middleware after JWT verify

        if (!userInfo || !userInfo.user_id) {
            response.msg = "Invalid user.";
            return utility.apiResponse(req, res, response);
        }

        // Fetch user full details
        let condition = `WHERE user_id = ${userInfo.user_id} AND is_delete = 0`;
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

        if (!userData || userData.length === 0) {
            response.msg = "User not found.";
            return utility.apiResponse(req, res, response);
        }

        // Format profile photo full URL
        if (userData.user_Profile_Photo) {
            userData.user_Profile_Photo =
                constants.vals.frontEndUserProfilePath + userData.user_Profile_Photo;
        }

        // Add referral wallet if needed (you can extend later)
        userData.total_wallet_balance = userData.user_Wallet_Amount;

        response.status = "success";
        response.data = userData;

        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
};



// Add User Address
exports.addUserAddress = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let bodyData = req?.body?.inputdata;

        let messages = {
            user_id: "User ID is required.",
            user_Address: "Address is required.",
            user_State: "State is required.",
            user_City: "City is required.",
            user_Pincode: "Pincode is required."
        };

        // Validate Required Fields
        for (let key in messages) {
            if (utility.checkEmptyString(bodyData[key])) {
                response.msg = messages[key];
                return utility.apiResponse(req, res, response);
            }
        }

        // Insert Address
        const params = {
            user_id: bodyData.user_id,
            user_Address: bodyData.user_Address || "",
            user_Landmark: bodyData.user_Landmark || "",
            user_State: bodyData.user_State,
            user_City: bodyData.user_City,
            user_Pincode: bodyData.user_Pincode,
            user_Latitude: bodyData.user_Latitude || null,
            user_Longitude: bodyData.user_Longitude || null,
            created_at: req.locals.now
        };

        const addressId = await dbQuery.insertSingle(constants.vals.defaultDB, "user_addresses", params);

        response.status = "success";
        response.msg = "Address added successfully.";
        response.data = { address_id: addressId };

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};


// Edit User Address

exports.editUserAddress = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let bodyData = req?.body?.inputdata;

        const messages = {
            address_id: "Address ID is required.",
            user_Address: "Address is required.",
            user_State: "State is required.",
            user_City: "City is required.",
            user_Pincode: "Pincode is required."
        };

        for (let key in messages) {
            if (utility.checkEmptyString(bodyData[key])) {
                response.msg = messages[key];
                return utility.apiResponse(req, res, response);
            }
        }

        // Check Address Exists
        let condition = `WHERE address_id=${bodyData.address_id} AND is_delete=0`;
        let addr = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, "user_addresses", condition, "address_id");

        if (!addr || addr.length === 0) {
            response.msg = "Address not found.";
            return utility.apiResponse(req, res, response);
        }

        const date = req.locals.now;
        let newValue = `
            user_Address='${bodyData.user_Address}',
            user_Landmark='${bodyData.user_Landmark || ""}',
            user_State='${bodyData.user_State}',
            user_City='${bodyData.user_City}',
            user_Pincode='${bodyData.user_Pincode}',
            user_Latitude='${bodyData.user_Latitude || null}',
            user_Longitude='${bodyData.user_Longitude || null}',
            updated_at='${date}'
        `;

        await dbQuery.updateRecord(constants.vals.defaultDB, "user_addresses", `address_id=${bodyData.address_id}`, newValue);

        response.status = "success";
        response.msg = "Address updated successfully.";

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};



// Delete User Address
exports.deleteUserAddress = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let bodyData = req?.body?.inputdata;

        if (utility.checkEmptyString(bodyData.address_id)) {
            response.msg = "Address ID is required.";
            return utility.apiResponse(req, res, response);
        }

        let condition = `WHERE address_id=${bodyData.address_id} AND is_delete=0`;
        let addr = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, "user_addresses", condition, "address_id");

        if (!addr || addr.length === 0) {
            response.msg = "Address not found.";
            return utility.apiResponse(req, res, response);
        }

        const date = req.locals.now;
        let newValue = `is_delete=1, deleted_at='${date}', updated_at='${date}'`;

        await dbQuery.updateRecord(constants.vals.defaultDB, "user_addresses", `address_id=${bodyData.address_id}`, newValue);

        response.status = "success";
        response.msg = "Address deleted successfully.";

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};



// List User Address

exports.userAddressList = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let bodyData = req?.body?.inputdata;

        if (utility.checkEmptyString(bodyData.user_id)) {
            response.msg = "User ID is required.";
            return utility.apiResponse(req, res, response);
        }

        let condition = `WHERE user_id=${bodyData.user_id} AND is_delete=0 ORDER BY created_at DESC`;

        let addressList = await dbQuery.fetchRecords(
            constants.vals.defaultDB,
            "user_addresses",
            condition,
            "address_id, user_Address, user_Landmark, user_State, user_City, user_Pincode, user_Latitude, user_Longitude, is_active, created_at"
        );

        response.status = "success";
        response.msg = "Address list fetched successfully.";
        response.data = addressList;

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};

// User logout
exports.userLogout = async (req, res) => {
    try {
        let response = { status: 'error', msg: '' };
        let userInfo = req?.userInfo;

        if (!userInfo || !userInfo.user_id) {
            response.msg = "Invalid user.";
            return utility.apiResponse(req, res, response);
        }

        const date = req.locals.now;

        // Clear JWT & Firebase Token
        const newValue = `
            user_Token = null,
            user_Firebase_Token = null,
            updated_at = '${date}'
        `;

        const condition = `user_id = ${userInfo.user_id}`;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "users",
            condition,
            newValue
        );

        // Add logout log  
        await utility.addAuthenticationLogs(
            userInfo.user_id,
            "Logout",
            "Success",
            req.ip
        );

        response.status = "success";
        response.msg = "You have been logged out successfully.";
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
};



// User pin verify
exports.userPinVerify = async (req, res) => {
    try {
        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;
        let userInfo = req?.userInfo;

        if (utility.checkEmptyString(bodyData.user_Pin)) {
            response['msg'] = 'Pin is required.';
            return utility.apiResponse(req, res, response);
        }

        if (userInfo.user_Pin == bodyData?.user_Pin) {
            response['status'] = 'success';
            response['msg'] = 'Pin has been verified successfully.';
            return utility.apiResponse(req, res, response);
        } else {
            response['status'] = 'error';
            response['msg'] = 'Pin incorrect.';
            return utility.apiResponse(req, res, response);
        }

    } catch (error) {
        throw error;
    }
}



// User profile update
exports.userProfileUpdate = async (req, res) => {
    try {
        let response = { status: 'error', msg: '' };
        let userInfo = req?.userInfo;
        let bodyData = req?.body?.inputdata;

        let messages = {
            user_Name: 'User name is required.',
            user_Mobile: 'Mobile number is required.'
        };

        // Required validation
        for (let key in messages) {
            if (utility.checkEmptyString(bodyData[key])) {
                response.msg = messages[key];
                return utility.apiResponse(req, res, response);
            }
        }

        // Validate Indian Mobile Number
        if (!constants.vals.regex.phone_number.test(bodyData.user_Mobile)) {
            response.msg = "Invalid mobile number.";
            return utility.apiResponse(req, res, response);
        }

        const date = req.locals.now;

        const newValue = `
            user_Name = '${bodyData.user_Name}',
            user_Mobile = '${bodyData.user_Mobile}',
            user_Solun_Name = '${bodyData?.user_Solun_Name || ""}',
            updated_at = '${date}'
        `;

        const condition = `user_id = ${userInfo.user_id}`;

        // Update user
        const updateData = await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "users",
            condition,
            newValue
        );

        if (!updateData) {
            response.msg = "Mobile number already exists.";
            return utility.apiResponse(req, res, response);
        }

        response.status = "success";
        response.msg = "Profile updated successfully.";

        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
};


// User profile update
exports.userAccountDelete = async (req, res) => {
    try {
        let response = { status: 'error', msg: '' };
        let userInfo = req?.userInfo;

        if (!userInfo || !userInfo.user_id) {
            response.msg = "Invalid user.";
            return utility.apiResponse(req, res, response);
        }

        const date = req.locals.now;

        const newValue = `
            user_Token = null,
            user_Firebase_Token = null,
            is_active = 0,
            is_delete = 1,
            updated_at = '${date}'
        `;

        const condition = `user_id = ${userInfo.user_id}`;

        await dbQuery.updateRecord(
            constants.vals.defaultDB,
            "users",
            condition,
            newValue
        );

        response.status = "success";
        response.msg = "Account deleted successfully.";

        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
};


// Update profile picture
exports.userProfilePictureChange = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let userInfo = req.userInfo;

        // Files uploaded via multer + FileManager
        const uploadedFiles = req?.body?.file || [];

        if (!uploadedFiles.length) {
            response.msg = "Please upload a profile picture.";
            return utility.apiResponse(req, res, response);
        }

        const newPhoto = uploadedFiles[0];

        // Remove old file if exists
        if (userInfo.user_Profile_Photo) {
            await FileManager.unlinkRemoveFile(
                "/userProfilePhoto",
                userInfo.user_Profile_Photo
            );
        }

        // Update DB
        const date = req.locals.now;
        const updateValue = `
            user_Profile_Photo = '${newPhoto}',
            updated_at = '${date}'
        `;

        const condition = `user_id = ${userInfo.user_id}`;

        await dbQuery.updateRecord(constants.vals.defaultDB, "users", condition, updateValue);

        response.status = "success";
        response.msg = "Profile picture updated successfully.";
        response.data = {
            user_id: userInfo.user_id,
            user_Profile_Photo: constants.vals.frontEndUserProfilePath + newPhoto
        };

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};



// Add Cart

exports.addToCart = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let user = req.userInfo;
        let body = req.body.inputdata;

        if (!body.product_id) {
            response.msg = "Product ID is required.";
            return utility.apiResponse(req, res, response);
        }

        let quantity = parseInt(body.quantity || 1);

        // Fetch product
        let productRow = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "products",
            `WHERE product_id=${body.product_id} AND status=1`,
            "product_id, product_sale_price"
        );

        let product = Array.isArray(productRow) ? productRow[0] : productRow;

        if (!product || !product.product_id) {
            response.msg = "Invalid product.";
            return utility.apiResponse(req, res, response);
        }

        let price = parseFloat(product.product_sale_price);

        // Fetch cart
        let cartRow = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "user_carts",
            `WHERE user_Id=${user.user_id} AND product_Id=${body.product_id} AND status='active'`,
            "cart_id, product_Quantity"
        );


        let cartItem = Array.isArray(cartRow) ? cartRow[0] : cartRow;

        if (cartItem && cartItem.cart_id) {
            // UPDATE CART
            let newQty = parseInt(cartItem.product_Quantity) + quantity;
            let totalAmt = newQty * price;

            await dbQuery.rawQuery(constants.vals.defaultDB,
                `UPDATE user_carts 
                 SET product_Quantity=${newQty}, 
                     product_Total_Amount=${totalAmt}, 
                     updated_at='${req.locals.now}'
                 WHERE cart_id=${cartItem.cart_id}`
            );

        } else {
            // INSERT NEW
            let totalAmt = quantity * price;

            await dbQuery.insertSingle(constants.vals.defaultDB, "user_carts", {
                user_Id: user.user_id,
                product_Id: body.product_id,
                product_Quantity: quantity,
                product_Amount: price,
                product_Total_Amount: totalAmt,
                status: 'active',
                created_at: req.locals.now
            });
        }

        response.status = "success";
        response.msg = "Product added to cart.";
        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};





// get Cart

exports.getCart = async (req, res) => {
    try {
        let user = req.userInfo;

        let sql = `
            SELECT 
                c.cart_id,
                c.product_Quantity,
                c.product_Amount,
                c.product_Total_Amount,

                p.product_id,
                p.product_name,
                p.product_description,
                p.product_sale_price,
                p.product_base_price,

                -- IMAGE
                (SELECT imageUrl FROM product_images WHERE product_id = p.product_id LIMIT 1) AS product_image,

                -- OFFER SECTION
                IF(o.offer_id IS NULL, 0, 1) AS has_offer,
                o.offer_Discount,
                o.offer_Type,

                -- FINAL PRICE CALCULATION IF OFFER EXISTS
                CASE 
                    WHEN o.offer_id IS NOT NULL AND o.offer_Type = 'percentage'
                        THEN (p.product_sale_price - ((p.product_sale_price * o.offer_Discount) / 100))
                    WHEN o.offer_id IS NOT NULL AND o.offer_Type = 'flat'
                        THEN (p.product_sale_price - o.offer_Discount)
                    ELSE p.product_sale_price
                END AS final_price_after_offer

            FROM user_carts AS c
            JOIN products AS p ON c.product_Id = p.product_id

            -- JOIN OFFER TABLE FOR USER+PRODUCT
            LEFT JOIN offers AS o 
                ON o.user_Id = ${user.user_id} 
                AND o.product_Id = p.product_id 
                AND o.deleted_at IS NULL

            WHERE c.user_Id = ${user.user_id}
            AND c.status='active'
        `;

        let list = await dbQuery.rawQuery(constants.vals.defaultDB, sql);

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Cart fetched.",
            data: { list }
        });

    } catch (err) {
        throw err;
    }
};


//
// PLACE ORDER
exports.placeOrder = async (req, res) => {
    try {
        let user = req.userInfo;
        let body = req.body.inputdata;
        let response = { status: "error", msg: "" };

        if (!body.address_id) {
            response.msg = "Address ID is required.";
            return utility.apiResponse(req, res, response);
        }
        if (!body.payment_mode) {
            response.msg = "Payment mode is required.";
            return utility.apiResponse(req, res, response);
        }

        // Fetch cart with stock info
        let cartItems = await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `
            SELECT c.*, 
                   p.product_sale_price, 
                   p.available_quantity 
            FROM user_carts c
            JOIN products p ON c.product_Id = p.product_id
            WHERE c.user_Id=${user.user_id} AND c.status='active'
            `
        );

        if (!cartItems || cartItems.length === 0) {
            response.msg = "Cart is empty.";
            return utility.apiResponse(req, res, response);
        }

        // STOCK CHECK
        for (let item of cartItems) {
            if (item.product_Quantity > item.available_quantity) {
                response.msg = `Insufficient stock for product ID ${item.product_Id}`;
                return utility.apiResponse(req, res, response);
            }
        }

        let originalAmount = 0;
        let finalAmount = 0;
        let offerFound = false;
        let totalOfferDiscount = 0;

        // Offer calculation
        for (let item of cartItems) {
            let qty = parseInt(item.product_Quantity) || 1;
            let price = parseFloat(item.product_sale_price) || 0;

            let productTotal = qty * price;
            originalAmount += productTotal;

            let offer = await dbQuery.fetchSingleRecord(
                constants.vals.defaultDB,
                "offers",
                `WHERE user_Id=${user.user_id} AND product_Id=${item.product_Id}`,
                "offer_Discount, offer_Type"
            );

            if (offer) {
                offerFound = true;

                let discount =
                    offer.offer_Type === "percentage"
                        ? (productTotal * offer.offer_Discount) / 100
                        : offer.offer_Discount;

                discount = parseFloat(discount) || 0;
                productTotal -= discount;
                totalOfferDiscount += discount;
            }

            finalAmount += productTotal;
        }

        // COUPON
        let couponId = null;
        let couponDiscountAmount = 0;

        if (body.coupon_code) {
            let coupon = await dbQuery.fetchSingleRecord(
                constants.vals.defaultDB,
                "coupons",
                `WHERE coupon_Code='${body.coupon_code}'`,
                "coupon_id, coupons_Discount, coupons_Type"
            );

            if (coupon) {
                couponId = coupon.coupon_id;
                let couponDiscount = parseFloat(coupon.coupons_Discount) || 0;

                if (coupon.coupons_Type === "percentage")
                    couponDiscountAmount = (finalAmount * couponDiscount) / 100;
                else
                    couponDiscountAmount = couponDiscount;

                finalAmount -= couponDiscountAmount;
            }
        }

        finalAmount = Math.max(0, parseFloat(finalAmount.toFixed(2)));

        // Create order
        let orderId = await dbQuery.insertSingle(
            constants.vals.defaultDB,
            "user_orders",
            {
                user_id: user.user_id,
                order_amount: originalAmount,
                coupon_id: couponId,
                coupon_code: body.coupon_code || null,
                discount: totalOfferDiscount + couponDiscountAmount,
                delivery_charge: 0,
                total_amount: finalAmount,
                payment_mode: body.payment_mode,
                transaction_id: body.transaction_id || null,
                order_status: "pending",
                created_at: req.locals.now
            }
        );

        // REDUCE STOCK
        for (let item of cartItems) {
            await dbQuery.rawQuery(
                constants.vals.defaultDB,
                `
                UPDATE products 
                SET available_quantity = available_quantity - ${item.product_Quantity}
                WHERE product_id = ${item.product_Id}
                `
            );
        }

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Order placed successfully.",
            data: {
                order_id: orderId,
                discount: totalOfferDiscount + couponDiscountAmount,
                final_amount: finalAmount
            }
        });

    } catch (err) {
        console.error(err);
        throw err;
    }
};




//
exports.getWalletBalance = async (req, res) => {
    try {
        let user = req.userInfo;

        let walletRow = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "users",
            `WHERE user_id=${user.user_id}`,
            "user_Wallet_Amount"
        );

        let balance = parseFloat(walletRow?.user_Wallet_Amount || 0);

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Wallet balance fetched.",
            data: { wallet_amount: balance }
        });

    } catch (err) {
        throw err;
    }
};



exports.getMyCommission = async (req, res) => {
    try {
        let user = req.userInfo;

        let sql = `
            SELECT 
                w.wallet_id,
                w.amount AS commission_amount,
                w.status,
                w.created_at,

                o.order_id,
                o.total_amount AS order_total,
                o.order_status,
                o.created_at AS order_date,

                u.user_Name AS from_user,
                u.user_Mobile AS from_user_mobile

            FROM user_wallets w
            LEFT JOIN user_orders o ON o.order_id = w.order_id
            LEFT JOIN users u ON o.user_id = u.user_id
            
            WHERE w.user_id = ${user.user_id} 
              AND w.type = 'add'
            ORDER BY w.wallet_id DESC
        `;

        let list = await dbQuery.rawQuery(constants.vals.defaultDB, sql);

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Commission history fetched.",
            data: list
        });
    } catch (err) {
        throw err;
    }
};




//
// GET ORDER LIST
exports.getOrderList = async (req, res) => {
    try {
        let user = req.userInfo;

        let sql = `
            SELECT 
                o.order_id,
                o.total_amount,
                o.order_status,
                o.payment_mode,
                o.created_at
            FROM user_orders o
            WHERE o.user_id=${user.user_id}
            ORDER BY o.order_id DESC
        `;

        let orders = await dbQuery.rawQuery(constants.vals.defaultDB, sql);

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Order list fetched.",
            data: { orders }
        });

    } catch (err) { throw err; }
};



//
// GET ORDER DETAILS
exports.getOrderDetails = async (req, res) => {
    try {
        let user = req.userInfo;
        let body = req.body.inputdata;

        if (!body.order_id) {
            return utility.apiResponse(req, res, { status: "error", msg: "Order ID required." });
        }

        // Fetch order
        let order = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "user_orders",
            `WHERE order_id=${body.order_id} AND user_id=${user.user_id}`,
            "*"
        );

        if (!order) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Order not found."
            });
        }

        // Fetch order items (from cart table)
        let items = await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `SELECT 
                c.product_Id,
                c.product_Quantity,
                c.product_Total_Amount,
                p.product_name,
                p.product_sale_price,
                (SELECT imageUrl FROM product_images WHERE product_id=p.product_id LIMIT 1) AS product_image
             FROM user_carts c
             JOIN products p ON c.product_Id = p.product_id
             WHERE c.order_id=${body.order_id}`
        );

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Order details fetched.",
            data: { order, items }
        });

    } catch (err) { throw err; }
};



//
// Get cart totals (NO coupon, NO tax, NO delivery charge)
exports.getCartTotal = async (req, res) => {
    try {
        let user = req.userInfo;

        // Fetch cart + offer info
        let sql = `
            SELECT 
                c.cart_id,
                c.product_Quantity,
                p.product_id,
                p.product_sale_price,
                p.product_name,
                (SELECT imageUrl FROM product_images WHERE product_id=p.product_id LIMIT 1) AS product_image,
                o.offer_Discount,
                o.offer_Type
            FROM user_carts AS c
            JOIN products AS p ON c.product_Id = p.product_id
            LEFT JOIN offers AS o ON o.user_Id=${user.user_id} AND o.product_Id=p.product_id
            WHERE c.user_Id=${user.user_id} AND c.status='active'
        `;

        let items = await dbQuery.rawQuery(constants.vals.defaultDB, sql);

        let originalTotal = 0;         // total MRP
        let totalAfterOffers = 0;      // final after offer
        let totalOfferDiscount = 0;    // total discount amount

        items.forEach(row => {
            let qty = parseInt(row.product_Quantity);
            let price = parseFloat(row.product_sale_price);

            let original = price * qty;
            originalTotal += original;

            let finalPrice = price;

            // Apply user-specific offer if exists
            if (row.offer_Discount) {
                if (row.offer_Type === "percentage") {
                    finalPrice = price - (price * row.offer_Discount / 100);
                } else {
                    finalPrice = price - row.offer_Discount;
                }

                if (finalPrice < 0) finalPrice = 0;
            }

            let afterOffer = finalPrice * qty;

            totalAfterOffers += afterOffer;
            totalOfferDiscount += (original - afterOffer);
        });

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Cart totals calculated.",
            data: {
                original_total: parseFloat(originalTotal.toFixed(2)),
                total_offer_discount: parseFloat(totalOfferDiscount.toFixed(2)),
                final_payable: parseFloat(totalAfterOffers.toFixed(2)),
                items
            }
        });

    } catch (err) { throw err; }
};



// Delete from cart

exports.removeCart = async (req, res) => {
    try {
        let body = req.body.inputdata;

        if (!body.cart_id) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Cart ID required."
            });
        }

        await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `UPDATE user_carts 
             SET status='removed', updated_at='${req.locals.now}' 
             WHERE cart_id=${body.cart_id}`
        );

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Cart removed."
        });

    } catch (err) { throw err; }
};


// Update Cart Quantity
exports.updateCartQuantity = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let user = req.userInfo;
        let body = req.body.inputdata;

        if (!body.cart_id) {
            response.msg = "Cart ID is required.";
            return utility.apiResponse(req, res, response);
        }

        if (!body.quantity || body.quantity < 1) {
            response.msg = "Quantity must be at least 1.";
            return utility.apiResponse(req, res, response);
        }

        let quantity = parseInt(body.quantity);

        // Fetch cart item
        let cartRow = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "user_carts",
            `WHERE cart_id=${body.cart_id} AND user_Id=${user.user_id} AND status='active'`,
            "cart_id, product_Id"
        );

        let cartItem = Array.isArray(cartRow) ? cartRow[0] : cartRow;

        if (!cartItem || !cartItem.cart_id) {
            response.msg = "Cart item not found.";
            return utility.apiResponse(req, res, response);
        }

        // Fetch product price
        let productRow = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "products",
            `WHERE product_id=${cartItem.product_Id}`,
            "product_sale_price"
        );

        let product = Array.isArray(productRow) ? productRow[0] : productRow;

        if (!product) {
            response.msg = "Product not found.";
            return utility.apiResponse(req, res, response);
        }

        let price = parseFloat(product.product_sale_price);
        let totalAmount = price * quantity;

        // Update quantity
        await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `UPDATE user_carts 
             SET product_Quantity=${quantity},
                 product_Total_Amount=${totalAmount},
                 updated_at='${req.locals.now}' 
             WHERE cart_id=${body.cart_id}`
        );

        response.status = "success";
        response.msg = "Cart quantity updated successfully.";

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};



// Add Wishlist

exports.addWishlist = async (req, res) => {
    try {
        let user = req.userInfo;
        let body = req.body.inputdata;

        if (!body.product_id) {
            return utility.apiResponse(req, res, { status: "error", msg: "Product ID required." });
        }

        let existsRow = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "user_wishlists",
            `WHERE user_id=${user.user_id} AND product_id=${body.product_id}`,
            "wishlist_id"
        );


        // Normalize result
        let exists = Array.isArray(existsRow)
            ? existsRow[0]
            : existsRow && typeof existsRow === "object"
                ? existsRow
                : null;


        if (exists && exists.wishlist_id) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Already in wishlist."
            });
        }

        let id = await dbQuery.insertSingle(constants.vals.defaultDB, "user_wishlists", {
            user_id: user.user_id,
            product_id: body.product_id,
            created_at: req.locals.now
        });

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Added to wishlist.",
            data: { wishlist_id: id }
        });

    } catch (err) {
        throw err;
    }
};

//
// Apply coupon to user's cart
exports.applyCoupon = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };

        const user = req.userInfo;
        const body = req.body.inputdata || {};
        const couponCode = body.coupon_code?.trim();

        if (!couponCode) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Coupon code is required"
            });
        }

        // calculate cart
        const cart = await calculateCartWithOffers(user.user_id);
        if (cart.empty) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Cart is empty."
            });
        }

        // fetch coupon
        const coupon = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "coupons",
            `WHERE coupon_Code='${couponCode}' LIMIT 1`,
            "coupon_id, coupon_Code, coupons_Discount, coupons_Type"
        );

        if (!coupon) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Invalid coupon code"
            });
        }

        const couponDisc = parseFloat(coupon.coupons_Discount);
        const couponType = coupon.coupons_Type.toLowerCase();

        if (cart.nonOfferSubtotal <= 0) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Coupon cannot be applied. All items already have offers."
            });
        }

        // calculate coupon discount
        let couponDiscountAmount = 0;

        if (couponType === "percentage") {
            couponDiscountAmount = cart.nonOfferSubtotal * (couponDisc / 100);
        } else {
            couponDiscountAmount = couponDisc;
        }

        if (couponDiscountAmount > cart.nonOfferSubtotal)
            couponDiscountAmount = cart.nonOfferSubtotal;

        const finalPayable = cart.totalAfterOffers - couponDiscountAmount;

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Coupon applied",
            data: {
                coupon: {
                    coupon_id: coupon.coupon_id,
                    coupon_code: coupon.coupon_Code,
                    coupons_Discount: couponDisc,
                    coupons_Type: couponType
                },
                totals: {
                    original_total: cart.originalTotal,
                    total_offer_discount: cart.totalOfferDiscount,
                    total_after_offers: cart.totalAfterOffers,
                    coupon_eligible_amount: cart.nonOfferSubtotal,
                    coupon_discount_amount: couponDiscountAmount,
                    payable_amount: parseFloat(finalPayable.toFixed(2))
                },
                items_breakdown: cart.items
            }
        });

    } catch (err) {
        throw err;
    }
};


// Get Wishlist

exports.getWishlist = async (req, res) => {
    try {
        let user = req.userInfo;

        let sql = `
            SELECT 
                w.wishlist_id,
                p.product_id,
                p.product_name,
                p.product_description,
                p.product_sale_price,
                (SELECT imageUrl FROM product_images WHERE product_id = p.product_id LIMIT 1) AS product_image
            FROM user_wishlists AS w
            JOIN products AS p ON w.product_id = p.product_id
            WHERE w.user_id = ${user.user_id}
        `;

        let list = await dbQuery.rawQuery(constants.vals.defaultDB, sql);

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Wishlist fetched.",
            data: { list }
        });

    } catch (err) { throw err; }
};


// Remove Wishlist

exports.removeWishlist = async (req, res) => {
    try {
        let body = req.body.inputdata;

        if (!body.wishlist_id) {
            return utility.apiResponse(req, res, { status: "error", msg: "Wishlist ID required." });
        }

        await dbQuery.deleteRecord(constants.vals.defaultDB, "user_wishlists", `wishlist_id=${body.wishlist_id}`);

        return utility.apiResponse(req, res, { status: "success", msg: "Removed from wishlist." });

    } catch (err) { throw err; }
};


exports.withdrawWallet = async (req, res) => {
    try {
        let user = req.userInfo;
        let body = req.body.inputdata;

        if (!body.amount) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Withdrawal amount is required."
            });
        }

        let amount = parseFloat(body.amount);
        if (isNaN(amount) || amount <= 0) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Invalid withdrawal amount."
            });
        }

        // Fetch current balance
        let userRow = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "users",
            `WHERE user_id=${user.user_id}`,
            "user_Wallet_Amount"
        );

        let currentBalance = parseFloat(userRow?.user_Wallet_Amount || 0);

        if (amount > currentBalance) {
            return utility.apiResponse(req, res, {
                status: "error",
                msg: "Insufficient wallet balance."
            });
        }

        // Add request in wallet table as PENDING
        let withdrawId = await dbQuery.insertSingle(
            constants.vals.defaultDB,
            "user_wallets",
            {
                user_id: user.user_id,
                amount: amount,
                type: "withdraw",
                status: "pending",   // waiting approval
                created_at: req.locals.now
            }
        );

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Withdrawal request submitted.",
            data: { withdraw_id: withdrawId, pending_amount: amount }
        });

    } catch (err) {
        throw err;
    }
};

// // list product
// exports.listProduct = async (req, res) => {
//     try {
//         let response = { status: "error", msg: "" };
//         let body = req?.body?.inputdata || {};
//         let admin = req?.userInfo;

//         let page = parseInt(body.page) || 1;
//         let limit = parseInt(body.limit) || 10;
//         let offset = (page - 1) * limit;

//         let where = `WHERE p.status = 1`;

//         if (admin.admin_Type === "admin") {
//             where += ` AND p.admin_id=${admin.admin_Id}`;
//         }

//         if (body.category_id) {
//             where += ` AND p.category_id=${body.category_id}`;
//         }

//         if (body.sub_category_id) {
//             where += ` AND p.sub_category_id=${body.sub_category_id}`;
//         }

//         // ⭐ FINAL QUERY
//         const sql = `
//             SELECT 
//                 p.product_id,
//                 p.product_name,
//                 p.product_slug,
//                 p.product_description,
//                 p.product_base_price,
//                 p.product_sale_price,
//                 p.product_tags,
//                 p.product_review,
//                 p.created_at,
//                 c.category_Name,
//                 sc.sub_Category_Name,

//                 -- ⭐ GROUP ATTRIBUTES
//                 JSON_ARRAYAGG(
//                     JSON_OBJECT(
//                         'attribute_id', pav.attribute_id,
//                         'attribute_name', att.name,
//                         'values',
//                         (
//                             SELECT JSON_ARRAYAGG(val.value)
//                             FROM product_attribute_values pav2
//                             JOIN attribute_values val ON pav2.value_id = val.value_id
//                             WHERE pav2.product_id = p.product_id
//                             AND pav2.attribute_id = pav.attribute_id
//                         )
//                     )
//                 ) AS product_attributes

//             FROM products AS p
//             LEFT JOIN categories AS c ON p.category_id = c.category_id
//             LEFT JOIN sub_categories AS sc ON p.sub_category_id = sc.sub_category_id
//             LEFT JOIN product_attribute_values pav ON pav.product_id = p.product_id
//             LEFT JOIN attributes att ON att.attribute_id = pav.attribute_id

//             ${where}
//             GROUP BY p.product_id
//             ORDER BY p.product_id DESC
//             LIMIT ${limit} OFFSET ${offset}
//         `;

//         const list = await dbQuery.rawQuery(constants.vals.defaultDB, sql);

//         // ⭐ COUNT QUERY
//         const countQuery = `
//             SELECT COUNT(*) AS total
//             FROM products AS p
//             ${where}
//         `;

//         const countData = await dbQuery.rawQuery(constants.vals.defaultDB, countQuery);

//         response.status = "success";
//         response.msg = "Product list fetched.";
//         response.data = {
//             list,
//             pagination: {
//                 page,
//                 limit,
//                 total: countData[0]?.total || 0
//             }
//         };

//         return utility.apiResponse(req, res, response);

//     } catch (err) {
//         throw err;
//     }
// };


exports.userAllProducts = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata || {};

        let page = parseInt(body.page) || 1;
        let limit = parseInt(body.limit) || 20;
        let offset = (page - 1) * limit;

        let where = `WHERE p.status = 1 AND p.available_quantity > 0`;

        if (body.category_id) where += ` AND p.category_id=${body.category_id}`;
        if (body.sub_category_id) where += ` AND p.sub_category_id=${body.sub_category_id}`;

        // MAIN PRODUCT QUERY
        const products = await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `
            SELECT 
                p.product_id,
                p.product_name,
                p.product_slug,
                p.product_description,
                p.product_base_price,
                p.product_sale_price,
                p.product_tags,
                p.product_review,
                p.created_at,
                c.category_Name,
                sc.sub_Category_Name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN sub_categories sc ON p.sub_category_id = sc.sub_category_id
            ${where}
            ORDER BY p.product_id DESC
            LIMIT ${limit} OFFSET ${offset}
            `
        );

        // ENRICH EACH PRODUCT
        for (let p of products) {
            
            // IMAGES
            const images = await dbQuery.rawQuery(
                constants.vals.defaultDB,
                `SELECT imageUrl FROM product_images WHERE product_id=${p.product_id}`
            );
            p.images = images.map(i => i.imageUrl);

            // ATTRIBUTES
            const attributesRaw = await dbQuery.rawQuery(
                constants.vals.defaultDB,
                `
                SELECT 
                    pav.attribute_id,
                    a.name AS attribute_name,
                    v.value
                FROM product_attribute_values pav
                JOIN attributes a ON pav.attribute_id = a.attribute_id
                JOIN attribute_values v ON pav.value_id = v.value_id
                WHERE pav.product_id = ${p.product_id}
                `
            );

            // GROUP attributes manually
            const grouped = {};
            for (let row of attributesRaw) {
                if (!grouped[row.attribute_id]) {
                    grouped[row.attribute_id] = {
                        attribute_id: row.attribute_id,
                        attribute_name: row.attribute_name,
                        values: []
                    };
                }
                grouped[row.attribute_id].values.push(row.value);
            }
            p.attributes = Object.values(grouped);
        }

        // COUNT
        const count = await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `SELECT COUNT(*) AS total FROM products p ${where}`
        );

        response.status = "success";
        response.msg = "All products fetched.";
        response.data = {
            products,
            pagination: {
                page,
                limit,
                total: count[0]?.total || 0
            }
        };

        return utility.apiResponse(req, res, response);

    } catch (err) {
        throw err;
    }
};




exports.userHomeProductList = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };

        // ============================
        // ⭐ FETCH FEATURED PRODUCTS
        // ============================
        const featured = await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `
            SELECT 
                p.product_id,
                p.product_name,
                p.product_slug,
                p.product_description,
                p.product_base_price,
                p.product_sale_price,
                p.product_tags,
                p.product_review,
                p.created_at,
                c.category_Name,
                sc.sub_Category_Name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN sub_categories sc ON p.sub_category_id = sc.sub_category_id
            WHERE p.status = 1 AND p.available_quantity > 0
            ORDER BY p.product_id DESC
            LIMIT 10
            `
        );

        // ============================
        // ⭐ FETCH BEST SELLING PRODUCTS
        // ============================
        const bestSelling = await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `
            SELECT 
                p.product_id,
                p.product_name,
                p.product_slug,
                p.product_description,
                p.product_base_price,
                p.product_sale_price,
                p.product_tags,
                p.product_review,
                p.created_at,
                c.category_Name,
                sc.sub_Category_Name,
                COUNT(carts.product_Id) AS total_sold
            FROM user_carts carts
            JOIN products p ON p.product_id = carts.product_Id
            LEFT JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN sub_categories sc ON p.sub_category_id = sc.sub_category_id
            WHERE carts.status = 'ordered'
              AND p.status = 1          -- Active
              AND p.available_quantity > 0  -- In stock
            GROUP BY carts.product_Id
            ORDER BY total_sold DESC
            LIMIT 10
            `
        );

        // ============================
        // ⭐ ENRICH PRODUCT FUNCTION
        // ============================
        const enrichProduct = async (p) => {
            // IMAGES
            const images = await dbQuery.rawQuery(
                constants.vals.defaultDB,
                `SELECT imageUrl FROM product_images WHERE product_id=${p.product_id}`
            );
            p.images = images.map(i => i.imageUrl);

            // ATTRIBUTES
            const attrRows = await dbQuery.rawQuery(
                constants.vals.defaultDB,
                `
                SELECT pav.attribute_id, a.name AS attribute_name, v.value
                FROM product_attribute_values pav
                JOIN attributes a ON pav.attribute_id = a.attribute_id
                JOIN attribute_values v ON pav.value_id = v.value_id
                WHERE pav.product_id = ${p.product_id}
                `
            );

            const grouped = {};
            for (let row of attrRows) {
                if (!grouped[row.attribute_id]) {
                    grouped[row.attribute_id] = {
                        attribute_id: row.attribute_id,
                        attribute_name: row.attribute_name,
                        values: []
                    };
                }
                grouped[row.attribute_id].values.push(row.value);
            }

            p.attributes = Object.values(grouped);
        };

        // Enrich featured products
        for (let p of featured) await enrichProduct(p);

        // Enrich best selling
        for (let p of bestSelling) await enrichProduct(p);

        // ============================
        // ⭐ FINAL RESPONSE
        // ============================
        response.status = "success";
        response.msg = "Featured & Best Selling products fetched.";
        response.data = {
            featured_products: featured,
            best_selling_products: bestSelling
        };

        return utility.apiResponse(req, res, response);

    } catch (err) {
        console.error(err);
        throw err;
    }
};



exports.userFilterProducts = async (req, res) => {
    try {
        let body = req.body.inputdata || {};
        let { 
            category_id, 
            sub_category_id, 
            min_price, 
            max_price, 
            attributes = [],
            page = 1, 
            limit = 20 
        } = body;

        let offset = (page - 1) * limit;

        let where = `WHERE p.status = 1 AND p.available_quantity > 0`;


        if (category_id) where += ` AND p.category_id = ${category_id}`;
        if (sub_category_id) where += ` AND p.sub_category_id = ${sub_category_id}`;
        if (min_price) where += ` AND p.product_sale_price >= ${min_price}`;
        if (max_price) where += ` AND p.product_sale_price <= ${max_price}`;

        // main safe query
        const productList = await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `
            SELECT 
                p.product_id,
                p.product_name,
                p.product_slug,
                p.product_description,
                p.product_base_price,
                p.product_sale_price,
                p.product_review,
                p.product_tags,
                p.created_at,
                c.category_Name,
                sc.sub_Category_Name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN sub_categories sc ON p.sub_category_id = sc.sub_category_id
            ${where}
            ORDER BY p.product_id DESC
            LIMIT ${limit} OFFSET ${offset}
            `
        );

        // Fetch images & attributes per product
        for (let p of productList) {
            const images = await dbQuery.rawQuery(
                constants.vals.defaultDB,
                `SELECT imageUrl FROM product_images WHERE product_id=${p.product_id}`
            );
            p.images = images.map(i => i.imageUrl);

            const attrRows = await dbQuery.rawQuery(
                constants.vals.defaultDB,
                `
                SELECT pav.attribute_id, a.name AS attribute_name, v.value
                FROM product_attribute_values pav
                JOIN attributes a ON pav.attribute_id = a.attribute_id
                JOIN attribute_values v ON pav.value_id = v.value_id
                WHERE pav.product_id = ${p.product_id}
                `
            );

            let grouped = {};
            for (let row of attrRows) {
                if (!grouped[row.attribute_id]) {
                    grouped[row.attribute_id] = {
                        attribute_id: row.attribute_id,
                        attribute_name: row.attribute_name,
                        values: []
                    };
                }
                grouped[row.attribute_id].values.push(row.value);
            }

            p.attributes = Object.values(grouped);
        }

        return utility.apiResponse(req, res, {
            status: "success",
            msg: "Filtered products fetched.",
            data: productList
        });

    } catch (err) {
        console.error(err);
        throw err;
    }
};

exports.userAddProductReview = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let user = req.userInfo;
        let body = req.body.inputdata;

        if (!body.product_id) {
            response.msg = "Product ID is required.";
            return utility.apiResponse(req, res, response);
        }

        if (!body.review || body.review < 1 || body.review > 5) {
            response.msg = "Review star must be between 1 to 5.";
            return utility.apiResponse(req, res, response);
        }

        // Check if product exists
        let product = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "products",
            `WHERE product_id=${body.product_id} AND status=1`,
            "product_id"
        );

        if (!product) {
            response.msg = "Invalid product.";
            return utility.apiResponse(req, res, response);
        }

        // ----------------------------------------------------------
        // ⭐ CHECK USER HAS PURCHASED THIS PRODUCT
        // ----------------------------------------------------------
        const purchased = await dbQuery.rawQuery(
            constants.vals.defaultDB,
            `
            SELECT uo.order_id
            FROM user_orders uo
            JOIN user_carts uc ON uc.order_id = uo.order_id
            WHERE uo.user_id = ${user.user_id}
            AND uc.product_Id = ${body.product_id}
            AND uo.order_status = 'delivered'
            LIMIT 1
            `
        );

        if (purchased.length === 0) {
            response.msg = "You can review only purchased products.";
            return utility.apiResponse(req, res, response);
        }

        // ----------------------------------------------------------
        // ⭐ CHECK IF USER ALREADY REVIEWED — THEN UPDATE
        // ----------------------------------------------------------
        const existingReview = await dbQuery.fetchSingleRecord(
            constants.vals.defaultDB,
            "product_reviews",
            `WHERE user_id=${user.user_id} AND product_id=${body.product_id}`,
            "review_id"
        );

        if (existingReview) {
            // UPDATE
            await dbQuery.updateRecord(
                constants.vals.defaultDB,
                "product_reviews",
                {
                    review: body.review,
                    comment: body.comment || "",
                    updated_at: req.locals.now
                },
                `review_id=${existingReview.review_id}`
            );

            response.status = "success";
            response.msg = "Review updated successfully.";
            return utility.apiResponse(req, res, response);
        }

        // ----------------------------------------------------------
        // ⭐ INSERT NEW REVIEW
        // ----------------------------------------------------------
        const insertId = await dbQuery.insertSingle(
            constants.vals.defaultDB,
            "product_reviews",
            {
                user_id: user.user_id,
                product_id: body.product_id,
                review: body.review,
                comment: body.comment || "",
                created_at: req.locals.now
            }
        );

        response.status = "success";
        response.msg = "Review added successfully.";
        response.data = { review_id: insertId };

        return utility.apiResponse(req, res, response);

    } catch (err) {
        console.error(err);
        throw err;
    }
};



// CATEGORY: LIST WITH PAGINATION
exports.userListCategory = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };

        // USER view → no admin filter
        let where = "WHERE is_delete = 0";

        const listQuery = `
            SELECT 
                category_id,
                category_Name,
                category_Slug,
                created_at
            FROM categories
            ${where}
            ORDER BY category_id DESC
        `;

        const list = await dbQuery.rawQuery(constants.vals.defaultDB, listQuery);

        response.status = "success";
        response.msg = "Category list fetched successfully.";
        response.data = list;

        return utility.apiResponse(req, res, response);

    } catch (err) {
        console.error(err);
        throw err;
    }
};



exports.userListSubCategory = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };

        let where = "WHERE sc.is_delete = 0";

        const listQuery = `
            SELECT 
                sc.sub_category_id,
                sc.category_Id,
                sc.sub_Category_Name,
                sc.sub_Category_Slug,
                sc.created_at,
                c.category_Name
            FROM sub_categories AS sc
            LEFT JOIN categories AS c ON sc.category_Id = c.category_id
            ${where}
            ORDER BY sc.sub_category_id DESC
        `;

        const list = await dbQuery.rawQuery(constants.vals.defaultDB, listQuery);

        response.status = "success";
        response.msg = "Sub category list fetched successfully.";
        response.data = list;

        return utility.apiResponse(req, res, response);

    } catch (err) {
        console.error(err);
        throw err;
    }
};



exports.userListSubCategoryByCategoryId = async (req, res) => {
    try {
        let response = { status: "error", msg: "" };
        let body = req?.body?.inputdata;

        if (!body.category_Id) {
            response.msg = "Category ID is required.";
            return utility.apiResponse(req, res, response);
        }

        const condition = `WHERE category_Id=${body.category_Id} AND is_delete=0`;

        const list = await dbQuery.fetchRecords(
            constants.vals.defaultDB,
            "sub_categories",
            `${condition} ORDER BY sub_category_id DESC`,
            "sub_category_id, sub_Category_Name, sub_Category_Slug"
        );

        response.status = "success";
        response.msg = "Sub category list fetched.";
        response.data = list;

        return utility.apiResponse(req, res, response);

    } catch (err) { throw err; }
};




async function updateUserWalletBalance(userId) {
    // Calculate total balance
    let row = await dbQuery.rawQuery(
        constants.vals.defaultDB,
        `SELECT 
            SUM(CASE WHEN type='add' THEN amount ELSE 0 END) -
            SUM(CASE WHEN type='withdraw' THEN amount ELSE 0 END) AS total
         FROM user_wallets 
         WHERE user_id=${userId} AND status='completed'`
    );

    let total = parseFloat(row[0]?.total || 0);

    // ❌ old wrong way → updateRecord() does not support objects
    // await dbQuery.updateRecord(...)

    // ✅ new correct way
    await dbQuery.rawQuery(
        constants.vals.defaultDB,
        `UPDATE users SET user_Wallet_Amount=${total} WHERE user_id=${userId}`
    );

    return total;
}



// User requests count
exports.userPoliceRequestCount = async (req, res) => {
    try {
        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let userInfo = req?.userInfo;

        let condition = `WHERE user_Id = '${userInfo?.user_Id}' AND is_active = 1 AND is_delete = 0`;
        let selectFields = 'COUNT(CASE WHEN police_request_Type = "Call Police Now" THEN 1 END) AS total_police_call, COUNT(CASE WHEN police_request_Type = "Emergency" THEN 1 END) AS total_emergency_call';

        const getData = await dbQuery.fetchSingleRecord(constants.vals.defaultDB, 'police_request', condition, selectFields);

        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        response['data'] = getData;
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}

// Get otp length
exports.getOtpLength = async (req, res) => {
    try {
        let response = {};
        response['status'] = 'error';
        response['msg'] = '';

        const resObj = {
            otp_length: constants.vals.optLength
        }

        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        response['data'] = resObj;
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}

// Get district list
exports.getDistrictList = async (req, res) => {
    try {
        let response = {};
        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        // response['data'] = constants.vals.districtList;
        response['data'] = { districtList: constants.vals.districtList, apiKey: constants.vals.google_api };
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}

// Get city list
exports.getCityList = async (req, res) => {
    try {
        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;

        const cityList = constants.vals.cityList[bodyData?.district_name];

        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        response['data'] = { cityList: cityList, apiKey: constants.vals.google_api };
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}

// Offline data
exports.offlineData = async (req, res) => {
    try {
        let response = {};
        response['status'] = 'error';
        response['msg'] = '';
        let bodyData = req?.body?.inputdata;

        const districtList = constants.vals.districtList;

        const data = [];

        for (district of districtList) {

            let obj = {
                district: district
            }

            let policeStationCondition = `WHERE police_station_District = '${district}' AND is_active = 1 AND is_delete = 0`;
            let policeStationFields = 'police_station_Id, police_station_Name, police_station_Area, police_station_Latitude, police_station_Longitude, police_station_phone';

            const policeStationData = await dbQuery.fetchRecords(constants.vals.defaultDB, 'police_station', policeStationCondition, policeStationFields);

            obj.policeStationData = policeStationData;

            data.push(obj);
        }

        response['status'] = 'success';
        response['msg'] = 'Request has been completed successfully.';
        response['data'] = data;
        return utility.apiResponse(req, res, response);

    } catch (error) {
        throw error;
    }
}


async function calculateCartWithOffers(userId) {

    const sql = `
        SELECT 
            c.cart_id,
            c.product_Quantity,
            p.product_id,
            p.product_sale_price,
            (SELECT imageUrl FROM product_images 
             WHERE product_id = p.product_id LIMIT 1) AS product_image,
            IF(o.offer_id IS NULL, 0, 1) AS has_offer,
            o.offer_Discount,
            o.offer_Type
        FROM user_carts AS c
        JOIN products AS p ON c.product_Id = p.product_id
        LEFT JOIN offers AS o 
            ON o.user_Id = ${userId} 
            AND o.product_Id = p.product_id
        WHERE c.user_Id = ${userId} AND c.status = 'active'
    `;

    const items = await dbQuery.rawQuery(constants.vals.defaultDB, sql);

    if (!items || items.length === 0) return { empty: true };

    let originalTotal = 0;
    let totalAfterOffers = 0;
    let totalOfferDiscount = 0;
    let nonOfferSubtotal = 0;
    const breakdown = [];

    for (const row of items) {
        const qty = parseInt(row.product_Quantity || 0);
        const price = parseFloat(row.product_sale_price || 0);

        const itemOriginalTotal = price * qty;
        originalTotal += itemOriginalTotal;

        let priceAfterOffer = price;
        let offerDiscountAmount = 0;

        if (row.has_offer && row.offer_Discount) {

            const disc = parseFloat(row.offer_Discount);
            const type = (row.offer_Type || "percentage").toLowerCase();

            if (type === "percentage") {
                priceAfterOffer = price - (price * disc / 100);
            } else {
                priceAfterOffer = price - disc;
            }

            if (priceAfterOffer < 0) priceAfterOffer = 0;

            offerDiscountAmount = (price - priceAfterOffer) * qty;
        } else {
            nonOfferSubtotal += itemOriginalTotal;
        }

        const itemAfterOffer = priceAfterOffer * qty;

        totalAfterOffers += itemAfterOffer;
        totalOfferDiscount += offerDiscountAmount;

        breakdown.push({
            cart_id: row.cart_id,
            product_id: row.product_id,
            qty,
            unit_price: price,
            original_total: itemOriginalTotal,
            has_offer: !!row.has_offer,
            price_after_offer: parseFloat(priceAfterOffer.toFixed(2)),
            total_after_offer: parseFloat(itemAfterOffer.toFixed(2)),
            offer_type: row.offer_Type || null,
            offer_discount: row.offer_Discount || null,
            product_image: row.product_image,
        });
    }

    return {
        empty: false,
        items: breakdown,
        originalTotal,
        totalAfterOffers,
        totalOfferDiscount,
        nonOfferSubtotal
    };
}