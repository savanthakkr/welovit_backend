var express = require("express");
var apiMiddleware = require("../middlewares/api");
const {requestReturn,trackOrder,getDeliveryEstimate,checkPincode,verifyPayment,cancelOrder, userRegister,userListCategory,userFilterProducts,userAddProductReview,userListSubCategoryByCategoryId,userListSubCategory,userHomeProductList,userAllProducts,getMyCommission, withdrawWallet, getWalletBalance,getCartTotal,placeOrder,getOrderList,getOrderDetails,applyCoupon,addToCart,getCart,updateCartQuantity, removeCart,addWishlist,getWishlist,removeWishlist, addUserAddress, editUserAddress, deleteUserAddress, userAddressList, userPhoneVerify, getUserDetails, userLogout, userProfileUpdate, userAccountDelete, userPoliceRequestCount, userProfilePictureChange, userOtpVerify, userResendOtp } = require("../controllers/UserController");
const { authentication } = require('../middlewares/authentication');
const FileManager = require("../helpers/file_manager");

var app = express();

// User phone number verify route
app.use("/verify_phone_no", apiMiddleware, userPhoneVerify);

// User otp verify route
app.use("/verify_otp", apiMiddleware, userOtpVerify);

// User otp resend route
app.use("/resend_otp", apiMiddleware, userResendOtp);

// User register route
app.use("/register", apiMiddleware, userRegister);

// User register route
app.use("/add_address", apiMiddleware, authentication, addUserAddress);



// list product
app.use("/list_product", apiMiddleware, authentication, userAllProducts);

// list userHomeProductList
app.use("/user_home_product", apiMiddleware, authentication, userHomeProductList);

// list userFilterProducts
app.use("/user_filter", apiMiddleware, authentication, userFilterProducts);

// list category
app.use("/list_category", apiMiddleware, authentication, userListCategory);

// list userListSubCategory
app.use("/list_sub_category", apiMiddleware, authentication, userListSubCategory);

// list userAddProductReview
app.use("/add_product_review", apiMiddleware, authentication, userAddProductReview);

// list userListSubCategoryByCategoryId
app.use("/list_sub_category_by_category_id", apiMiddleware, authentication, userListSubCategoryByCategoryId);

//
app.use("/add_cart", apiMiddleware, authentication, addToCart);

//
app.use("/get_cart", apiMiddleware, authentication, getCart);

//
app.use("/get_cart_total", apiMiddleware, authentication, getCartTotal);

//
app.use("/withdraw_wallet", apiMiddleware, authentication, withdrawWallet);

//
app.use("/get_my_commission", apiMiddleware, authentication, getMyCommission);

//
app.use("/request_return", apiMiddleware, authentication, requestReturn);
//
app.use("/place_order", apiMiddleware, authentication, placeOrder);
//
app.use("/track_order", apiMiddleware, authentication, trackOrder);
//
app.use("/get_delivery_estimate", apiMiddleware, authentication, getDeliveryEstimate);
//
app.use("/check_pincode", apiMiddleware, authentication, checkPincode);
//
app.use("/verify_payment", apiMiddleware, authentication, verifyPayment);


//
app.use("/cancel_order", apiMiddleware, authentication, cancelOrder);

//
app.use("/get_wallet_balance", apiMiddleware, authentication, getWalletBalance);

//
app.use("/get_order_list", apiMiddleware, authentication, getOrderList);

//
app.use("/get_order_details", apiMiddleware, authentication, getOrderDetails);

//
app.use("/remove_cart", apiMiddleware, authentication, removeCart);

//
app.use("/apply_coupon", apiMiddleware, authentication, applyCoupon);

//
app.use("/update_cart_quantity", apiMiddleware, authentication, updateCartQuantity);

//
app.use("/add_wishlist", apiMiddleware, authentication, addWishlist);

//
app.use("/remove_wishlist", apiMiddleware, authentication, removeWishlist);

//
app.use("/get_wishlist", apiMiddleware, authentication, getWishlist);

// User register route
app.use("/edit_address", apiMiddleware, authentication, editUserAddress);

// User register route
app.use("/delete_address", apiMiddleware, authentication, deleteUserAddress);

// User register route
app.use("/address_list", apiMiddleware, authentication, userAddressList);

// User details
app.use("/details", apiMiddleware, authentication, getUserDetails);

// User logout
app.use("/logout", apiMiddleware, authentication, userLogout);

// User profile update
app.use("/profile_update", apiMiddleware, authentication, userProfileUpdate);

// User account delete
app.use("/account_delete", apiMiddleware, authentication, userAccountDelete);


// Update profile picture
app.use(
    "/profile_picture/change",
    apiMiddleware,
    authentication,
    FileManager.userUploadProfilePicture('/userProfilePhoto/').array('file'),
    userProfilePictureChange
);






module.exports = app;