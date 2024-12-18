import { asynchandlers } from "../utils/asyncHandlers.js";
import {ApiError} from "../utils/apiError.js" 
import { User } from "../models/user.model.js"
import { ApiResponse } from "../utils/apiResponse.js"

const registerUser = asynchandlers( async(req , res) => {
 // get user details from frontend
 //validation  - not empty
 //check if user already exists: username and email
 //check for images , check for avatar
 // upload them to cloudinary , avatar
 // create user objects - create entry in db
 //remove password and refresh token field from response
 // check for user creation 
 //return response


  const {fullname , username , email , password}= req.body
   
 if (
    [fullname , username , email , password].some((field) =>  field?.trim() === "")
) {
    throw new ApiError(400 , "All fields are required")
 }
  
const existedUser = User.findOne({
    $or:[
        { username } , { email }
    ]
})


  if (existedUser) {
        throw new ApiError(409 , "User already email or username already exists")
    }
    
   const avatarLocalPath =  req.files?.avatar[0]?.path;
   const coverImageLocalPath = req.files?.coverImage[0]?.path

   if (!avatarLocalPath) {
       throw new ApiError(400 , "Avatar file is required")
   }

 const avatar =  await uploadOnCloudinary(avatarLocalPath);
 const coverImage = await uploadOnCloudinary(coverImage);

 if(!avatar){
    throw new ApiError(400, "avatar file is required")
 }

 const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username : username.toLowerCase()
})

 createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
 )

 if (!createdUser) {
    throw new ApiError(500 , "Somehing went wrong registering a user")
 }

 return res.status(201).json(
    new ApiResponse(200 , createdUser , "User registered sucessfully")
 )

} )

export {registerUser};