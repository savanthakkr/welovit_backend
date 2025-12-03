var express = require("express");
var apiMiddleware = require("../middlewares/api");
const {listAttributeWithValues,getAdminProfile,approveWithdraw, rejectWithdraw, addCoupon,listCoupons,deleteCoupon,addOffer,listOffers,deleteOffer, listAttributeValue, listAttribute, deleteAttributeValue, editAttributeValue, addAttributeValue, deleteAttribute, editAttribute, addAttribute, listCategory, updateProduct, deleteProduct, getProductDetails, listProduct, uploadProductImages, deleteProductImage, addProduct, listSubCategory,listSubCategoryByCategoryId, deleteSubCategory, editSubCategory, addSubCategory, deleteCategory, editCategory, addCategory, adminLogin, addAdmin, addPatrolUnit, addPoliceStation, adminList, patrolUnitList, policeOfficerList, policeOfficerView, updateAdmin, editPatrolUnit, editPoliceStation, logout, policeRequestList, deletePoliceStation, deletePatrolUnit, deleteAdmin, todayPoliceRequestList, patrolUnitListByPoliceStation, districtPoliceStationList, smsPayload, editSmsPayload } = require("../controllers/adminController");
const { adminAuthentication } = require('../middlewares/authentication');

var app = express();

// Login
app.use("/login", apiMiddleware, adminLogin);

// app.use("/createDatabase", apiMiddleware, createTenantDatabase);

// app.use("/addRegisterFields", apiMiddleware, addRegisterFields);

// Add admin officer
app.use("/add/add_attribute", apiMiddleware, adminAuthentication, addAttribute);

//
app.use("/get_admin_profile", apiMiddleware, adminAuthentication, getAdminProfile);

//
app.use("/ad_offer", apiMiddleware, adminAuthentication, addOffer);

//
app.use("/delete_offer", apiMiddleware, adminAuthentication, deleteOffer);

//
app.use("/list_offers", apiMiddleware, adminAuthentication, listOffers);

//
app.use("/add_coupon", apiMiddleware, adminAuthentication, addCoupon);

//
app.use("/approve_withdraw", apiMiddleware, adminAuthentication, approveWithdraw);

//
app.use("/reject_withdraw", apiMiddleware, adminAuthentication, rejectWithdraw);

//
app.use("/delete_coupon", apiMiddleware, adminAuthentication, deleteCoupon);

//
app.use("/list_coupons", apiMiddleware, adminAuthentication, listCoupons);

// Add admin officer
app.use("/add/add_attribute_value", apiMiddleware, adminAuthentication, addAttributeValue);

// Add admin officer
app.use("/add/delete_attribute", apiMiddleware, adminAuthentication, deleteAttribute);

// Add admin officer
app.use("/add/edit_attribute", apiMiddleware, adminAuthentication, editAttribute);


// Add admin officer
app.use("/add/delete_attribute_value", apiMiddleware, adminAuthentication, deleteAttributeValue);

// Add admin officer
app.use("/add/edit_attribute_value", apiMiddleware, adminAuthentication, editAttributeValue);


// Add admin officer
app.use("/add/list_attribute_with_values", apiMiddleware, adminAuthentication, listAttributeWithValues);

// Add admin officer
app.use("/add/list_attribute_value", apiMiddleware, adminAuthentication, listAttributeValue);

// Add admin officer
app.use("/add/list_attribute", apiMiddleware, adminAuthentication, listAttribute);

// Add admin officer
app.use("/add/admin", apiMiddleware, adminAuthentication, addAdmin);

// Admin list
app.use("/admin_list", apiMiddleware, adminAuthentication, adminList);

// Edit Admin
app.use("/admin/edit", apiMiddleware, adminAuthentication, updateAdmin);

// Logout
app.use("/logout", apiMiddleware, adminAuthentication, logout);

// Delete Admin 
app.use("/admin/delete", apiMiddleware, adminAuthentication, deleteAdmin);


// Add  Category
app.use("/add/add_category", apiMiddleware, adminAuthentication, addCategory);
// Edit  Category
app.use("/edit_category", apiMiddleware, adminAuthentication, editCategory);
// Delete Category
app.use("/admin/delete_category", apiMiddleware, adminAuthentication, deleteCategory);
// List  Category
app.use("/list_category", apiMiddleware, adminAuthentication, listCategory);
// Add sub Category
app.use("/admin/add_sub_category", apiMiddleware, adminAuthentication, addSubCategory);
// Edit sub Category
app.use("/admin/edit_sub_category", apiMiddleware, adminAuthentication, editSubCategory);
// Delete sub Category
app.use("/admin/delete_sub_category", apiMiddleware, adminAuthentication, deleteSubCategory);
// List sub Category
app.use("/admin/list_sub_category", apiMiddleware, adminAuthentication, listSubCategory);

// List sub-category by Category
app.use("/admin/list_sub_category_category", apiMiddleware, adminAuthentication, listSubCategoryByCategoryId);

// Add Product
app.use("/admin/add_product", apiMiddleware, adminAuthentication, addProduct);

// Update Product
app.use("/admin/update_product", apiMiddleware, adminAuthentication, updateProduct);

// Delete Product
app.use("/admin/delete_product", apiMiddleware, adminAuthentication, deleteProduct);

// list Product details
app.use("/admin/get_product_details", apiMiddleware, adminAuthentication, getProductDetails);

// list Product
app.use("/admin/list_product", apiMiddleware, adminAuthentication, listProduct);


// Upload Product Image
app.use("/admin/upload_product_image", apiMiddleware, adminAuthentication, uploadProductImages);


// Delete Product Image
app.use("/admin/delete_product_image", apiMiddleware, adminAuthentication, deleteProductImage);



// Add patrol unit
app.use("/add/patrol_unit", apiMiddleware, adminAuthentication, addPatrolUnit);

// Add police station
app.use("/add/police_station", apiMiddleware, adminAuthentication, addPoliceStation);

// District police station list
app.use("/district_police_station_list", apiMiddleware, adminAuthentication, districtPoliceStationList);

// Patrol unit list
app.use("/patrol_unit_list", apiMiddleware, adminAuthentication, patrolUnitList);

// Police officer list
app.use("/police_officer_list", apiMiddleware, adminAuthentication, policeOfficerList);

// Edit patrol unit
app.use("/petrol_unit/edit", apiMiddleware, adminAuthentication, editPatrolUnit);

// Edit police station
app.use("/police_station/edit", apiMiddleware, adminAuthentication, editPoliceStation);

// Get police request list
app.use("/police_request/list", apiMiddleware, adminAuthentication, policeRequestList);

// Delete police station
app.use("/police_station/delete", apiMiddleware, adminAuthentication, deletePoliceStation);

// Delete patrol unit
app.use("/patrol_unit/delete", apiMiddleware, adminAuthentication, deletePatrolUnit);

// Get today's incident list
app.use("/police_requests/today", apiMiddleware, adminAuthentication, todayPoliceRequestList);

// Get today's incident list
app.use("/patrol_unit_list_by_police_station_id", apiMiddleware, adminAuthentication, patrolUnitListByPoliceStation);

// Get sms payload
app.use('/smsPayload', apiMiddleware, adminAuthentication, smsPayload);

// Edit sms payload
app.use('/smsPayloadEdit', apiMiddleware, adminAuthentication, editSmsPayload);

module.exports = app;