import { asynchandlers } from "../utils/asyncHandlers.js";
import { ApiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { ApiResponse } from "../utils/apiResponse.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";



const generateAccessAndRefreshTokens = async (userId) => {
   try {
      const user = await User.findById(userId)
      //console.log(user)
      const accessToken = user.generateAccessToken()
      const refreshToken = user.generateRefreshToken()
      //console.log(`acessToken: ${accessToken} and refresh token : ${refreshToken}`);
      user.refreshToken = refreshToken
      await user.save({ validateBeforeSave: false })

      return { accessToken, refreshToken }

   } catch (error) {
      throw new ApiError(500, "Something went wrong while generating refresh and access token ")
   }
}


const registerUser = asynchandlers(async (req, res) => {
   // get user details from frontend
   //validation  - not empty
   //check if user already exists: username and email
   //check for images , check for avatar
   // upload them to cloudinary , avatara
   // create user objects - create entry in db
   //remove password and refresh token field from response
   // check for user creation 
   //return response


   const { fullname, username, email, password } = req.body

   if (
      [fullname, username, email, password].some((field) => field?.trim() === "")
   ) {
      throw new ApiError(400, "All fields are required")
   }

   const existedUser = await User.findOne({
      $or: [
         { username }, { email }
      ]
   })


   if (existedUser) {
      throw new ApiError(409, "User already email or username already exists")
   }

   const avatarLocalPath = req.files?.avatar[0]?.path;
   //const coverImageLocalPath = req.files?.coverImage[0]?.path
   let coverImageLocalPath;
   if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
      coverImageLocalPath = req.files.coverImage[0].path
   }

   if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is required")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath);
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);



   if (!avatar) {
      throw new ApiError(400, "avatar file is required")
   }

   const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase()
   })

   const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
   )

   if (!createdUser) {
      throw new ApiError(500, "Somehing went wrong registering a user")
   }

   return res.status(201).json(
      new ApiResponse(200, createdUser, "User registered sucessfully")
   )

})


const loginUser = asynchandlers(async (req, res) => {
   //req body -> data
   // username or email 
   //find the user
   //password check
   //access and refresh token
   // secure cookie


   const { email, username, password } = req.body
   if (!(username || email)) {

      throw new ApiErrorpiError(400, "Username or Email is required")
   }

   const user = await User.findOne({
      $or: [{ username }, { email }]
   })

   if (!user) {

      throw new ApiError(404, "User doesnot exits")
   }

   const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
      throw new ApiErrorpiError(401, "Password is incorrect")
   }

   const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

   const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

   const options = {
      httpOnly: true,
      secure: true
   }

   return res
      .status(200)
      .cookie("accesstoken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
         new ApiResponse(200, {
            user: loggedInUser, accessToken, refreshToken
         },
            "User Logged in sucessfully ")
      )
})

const logOutUser = asynchandlers(async (req, res) => {
   // Update the user to clear the refresh token
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: { refreshToken: undefined },
      },
      { new: true }
   );

   // Define cookie options
   const options = {
      httpOnly: true, // Note the correct spelling of 'httpOnly'
      secure: true,
      sameSite: "None",
   };

   // Clear the cookies by setting them to empty strings and short expiration times
   return res
      .status(200)
      .cookie("accesstoken", "", { ...options, maxAge: 0 })
      .cookie("refreshToken", "", { ...options, maxAge: 0 })
      .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAcessToken = asynchandlers(async (req, res) => {
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

   if (!incomingRefreshToken) {
      throw new ApiError(401, "unauthorized request")
   }

   try {
      const decodedToken = jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRET
      )

      const user = await User.findById(decodedToken?._id)


      if (!user) {
         throw new ApiError(401, "Invalid refresh token")
      }

      if (incomingRefreshToken !== user?.refreshToken) {
         throw new ApiError(401, "Refresh token is expired or used")
      }

      const options = {
         httpOnly: true,
         secure: true
      }

      const { newRefreshToken, accessToken } = await generateAccessAndRefreshTokens(user._id)

      return res
         .status(200)
         .cookie("accessToken", accessToken)
         .cookie("refreshToken", newRefreshToken, options)
         .json(
            new ApiResponse(
               200,
               { accessToken, newRefreshToken },
               "Access token refreshed"
            )
         )
   } catch (error) {
      throw new ApiError(401, error?.message || "Invalid refresh token")
   }

})

const changeCurrentPassword = asynchandlers(async (req, res) => {
   const { oldPassword, newPassword } = req.body

   const user = await User.findById(req.user?._id)
   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
   if (!isPasswordCorrect) {
      throw new ApiError(400, "Invalid password")
   }

   user.password = newPassword
   await user.save({ validateBeforeSave: false })

   return res
      .status(200)
      .json(new ApiResponse({}, "Password changed sucessfully"))

})


const getCurrentUser = asynchandlers(async (req, res) => {
   return res
      .status(200)
      .json(200, req.user, "Current user fetch sucessfully")
})

const updateAccountDetails = asynchandlers(async (req, res) => {
   const { fullname, email } = req.body
   if (!fullname || !email) {
      throw new ApiError(400, "All fields are required")
   }

   const user = User.findByIdAndUpdate(
      req.user?._id,
   {
         $set: {
            fullname: fullname,
            email: email
         }

      },
      { new: true }
   ).select("-password")

   return res
      .status(200)
      .json(new ApiResponse(200, user, "Account details updated sucessfullly"))
})

const avatarUserUpdate = asynchandlers(async(req, res) => {
 const avatarLocalPath = req.file?.path
 if (!avatarLocalPath) {
    throw new ApiError(400 , "Avatar file is missing")
 }

const avatar =await uploadOnCloudinary(avatarLocalPath)

if(!avatar.url){
   throw new ApiError(400 , "Error while uploading on avatar")
}

const user = await User.findByIdAndUpdate(
   req.user?._id,
   {
      $set : {
         avatar: avatar.url
      }
   },
   {new: true}

).select("-password")

return res
.status(200)
.json(new ApiResponse(200, user,  "Avatar updated sucessfullly"))
})

const userCoverImageUpdate = asynchandlers(async(req, res) => {
   const coverImageLocalPath = req.file?.path
   if (!coverImageLocalPath) {
      throw new ApiError(400 , "CoverImage file is missing")
   }
  
  const coverImage =await uploadOnCloudinary(coverImageLocalPath)
  
  if(!coverImage.url){
     throw new ApiError(400 , "Error while uploading on CoverImage")
  }
  
 const user =  await User.findByIdAndUpdate(
     req.user?._id,
     {
        $set : {
           coverImage: coverImage.url
        }
     },
     {new: true}
  
  ).select("-password")
  
  return res
  .status(200)
  .json(new ApiResponse(200, user ,  "Cover Image updated sucessfullly"))
   
  })


export {
   registerUser,
   loginUser,
   logOutUser,
   refreshAcessToken,
   getCurrentUser,
   changeCurrentPassword,
   updateAccountDetails,
   avatarUserUpdate,
   userCoverImageUpdate
};