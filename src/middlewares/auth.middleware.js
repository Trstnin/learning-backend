import { asynchandlers } from "../utils/asyncHandlers.js"
import { ApiError } from "../utils/apiError.js"
import  jwt  from "jsonwebtoken"
import { User } from "../models/user.model.js"

export const verifyJWT = asynchandlers(async(req, res , next ) => {
   //console.log("Cookies:", req.cookies);
  // console.log("Headers:", req.headers);
   try {
     const token = req.cookies?.accesstoken || req.header("Authorization")?.replace("Bearer ", "")
     //console.log(token);
  
     if (!token) {
         throw new ApiError(401 , "Unauhtorized request")
     }
 
  const decodedToken = jwt.verify(token , process.env.ACCESS_TOKEN_SECRET)
 
  const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
 
  if (!user) {
     throw new ApiError(401,"Invalid Access Token")
  }
 
  req.user = user;
  next()
 
   } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token")
   }
})

