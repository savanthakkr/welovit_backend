var express = require("express");
var apiMiddleware = require("../middlewares/api");
const {
    downloadInvoice,
    rejectOrder,
    acceptOrder,
    getAllOrders,
    getOrderDetails,
    listAttributeWithValues,
    getAdminProfile,
    approveWithdraw,
    rejectWithdraw,
    addCoupon,
    listCoupons,
    deleteCoupon,
    addOffer,
    listOffers,
    deleteOffer,
    listAttributeValue,
    listAttribute,
    deleteAttributeValue,
    editAttributeValue,
    addAttributeValue,
    deleteAttribute,
    editAttribute,
    addAttribute,
    listCategory,
    updateProduct,
    deleteProduct,
    cancelShipment,
    getProductDetails,
    listProduct,
    uploadProductImages,
    deleteProductImage,
    rejectReturn,approveReturn,
    addProduct,
    listSubCategory,
    listSubCategoryByCategoryId,
    deleteSubCategory,
    editSubCategory,
    addSubCategory,
    deleteCategory,
    editCategory,
    addCategory,
    adminLogin,
    addAdmin,
    adminList,
    updateAdmin,
    createShipment,
    logout,
    deleteAdmin,
    adminMarkPickup,
    listCustomers,
    getCustomerDetails,
    getCustomerOrders,
    activateCustomer,
    deactivateCustomer
} = require("../controllers/adminController");
const { adminAuthentication } = require('../middlewares/authentication');
const FileManager = require("../helpers/file_manager");

var app = express();

// Login
app.use("/login", apiMiddleware, adminLogin);

// app.use("/createDatabase", apiMiddleware, createTenantDatabase);

// app.use("/addRegisterFields", apiMiddleware, addRegisterFields);

// Orders
app.use('/orders', apiMiddleware, adminAuthentication, getAllOrders);
app.use('/order_details', apiMiddleware, adminAuthentication, getOrderDetails);
app.use('/accept_order', apiMiddleware, adminAuthentication, acceptOrder);
app.use('/reject_order', apiMiddleware, adminAuthentication, rejectOrder);
app.use('/order/invoice', apiMiddleware, adminAuthentication, downloadInvoice);

// Customer management
app.use("/admin/customers/list", apiMiddleware, adminAuthentication, listCustomers);
app.use("/admin/customers/details", apiMiddleware, adminAuthentication, getCustomerDetails);
app.use("/admin/customers/orders", apiMiddleware, adminAuthentication, getCustomerOrders);
app.use("/admin/customers/activate", apiMiddleware, adminAuthentication, activateCustomer);
app.use("/admin/customers/deactivate", apiMiddleware, adminAuthentication, deactivateCustomer);

// Attributes
app.use("/add/add_attribute", apiMiddleware, adminAuthentication, addAttribute);
app.use("/add/add_attribute_value", apiMiddleware, adminAuthentication, addAttributeValue);
app.use("/add/delete_attribute", apiMiddleware, adminAuthentication, deleteAttribute);
app.use("/add/edit_attribute", apiMiddleware, adminAuthentication, editAttribute);
app.use("/add/delete_attribute_value", apiMiddleware, adminAuthentication, deleteAttributeValue);
app.use("/add/edit_attribute_value", apiMiddleware, adminAuthentication, editAttributeValue);
app.use("/add/list_attribute_with_values", apiMiddleware, adminAuthentication, listAttributeWithValues);
app.use("/add/list_attribute_value", apiMiddleware, adminAuthentication, listAttributeValue);
app.use("/add/list_attribute", apiMiddleware, adminAuthentication, listAttribute);

// Admin
app.use("/get_admin_profile", apiMiddleware, adminAuthentication, getAdminProfile);
app.use("/add/admin", apiMiddleware, adminAuthentication, addAdmin);
app.use("/admin_list", apiMiddleware, adminAuthentication, adminList);
app.use("/admin/edit", apiMiddleware, adminAuthentication, updateAdmin);
app.use("/logout", apiMiddleware, adminAuthentication, logout);
app.use("/admin/delete", apiMiddleware, adminAuthentication, deleteAdmin);

// Category & Subcategory
app.use("/add/add_category", apiMiddleware, adminAuthentication, addCategory);
app.use("/edit_category", apiMiddleware, adminAuthentication, editCategory);
app.use("/admin/delete_category", apiMiddleware, adminAuthentication, deleteCategory);
app.use("/list_category", apiMiddleware, adminAuthentication, listCategory);
app.use("/admin/add_sub_category", apiMiddleware, adminAuthentication, addSubCategory);
app.use("/admin/edit_sub_category", apiMiddleware, adminAuthentication, editSubCategory);
app.use("/admin/delete_sub_category", apiMiddleware, adminAuthentication, deleteSubCategory);
app.use("/admin/list_sub_category", apiMiddleware, adminAuthentication, listSubCategory);
app.use("/admin/list_sub_category_category", apiMiddleware, adminAuthentication, listSubCategoryByCategoryId);

// Products
app.use(
    "/admin/add_product",
    apiMiddleware,
    adminAuthentication,
    FileManager.userUploadImage('/Products/'),
    addProduct
);

app.use("/admin/update_product", apiMiddleware, adminAuthentication, updateProduct);
app.use("/admin/delete_product", apiMiddleware, adminAuthentication, deleteProduct);
app.use("/admin/get_product_details", apiMiddleware, adminAuthentication, getProductDetails);
app.use("/admin/list_product", apiMiddleware, adminAuthentication, listProduct);
app.use(
    "/admin/upload_product_image",
    apiMiddleware,
    adminAuthentication,
    FileManager.userUploadImage('/Products/'),
    uploadProductImages
);
app.use("/admin/delete_product_image", apiMiddleware, adminAuthentication, deleteProductImage);

// Coupons & Offers & Wallet
app.use("/approve_return", apiMiddleware, adminAuthentication, approveReturn);
app.use("/reject_return", apiMiddleware, adminAuthentication, rejectReturn);
app.use("/create_shipment", apiMiddleware, adminAuthentication, createShipment);
app.use("/cancel_shipment", apiMiddleware, adminAuthentication, cancelShipment);
app.use("/add_coupon", apiMiddleware, adminAuthentication, addCoupon);
app.use("/list_coupons", apiMiddleware, adminAuthentication, listCoupons);
app.use("/admin_mark_pickup", apiMiddleware, adminAuthentication, adminMarkPickup);
app.use("/delete_coupon", apiMiddleware, adminAuthentication, deleteCoupon);
app.use("/ad_offer", apiMiddleware, adminAuthentication, addOffer);
app.use("/delete_offer", apiMiddleware, adminAuthentication, deleteOffer);
app.use("/list_offers", apiMiddleware, adminAuthentication, listOffers);
app.use("/approve_withdraw", apiMiddleware, adminAuthentication, approveWithdraw);
app.use("/reject_withdraw", apiMiddleware, adminAuthentication, rejectWithdraw);

module.exports = app;