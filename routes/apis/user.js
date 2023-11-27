import * as dotenv from "dotenv"
import {getUsers, getUserById, addNewUser, loginUser, updateUser, 
    deleteUser, newId, createEdit, saveEdit, findRoleByName} from "../../database.js"
import express from 'express';
import bcrypt from "bcrypt"
import debug from 'debug';
import Joi from "joi";
import {validId} from '../../middleware/validId.js'
import {validBody} from '../../middleware/validBody.js'
import { removeEmptyStrings } from "../../middleware/removeEmptyStrings.js";
import  Jwt from "jsonwebtoken";
import {isLoggedIn, fetchRoles, mergePermissions, hasPermission} from "@merlin4/express-auth";

const newUserSchema = Joi.object({
    fullName: Joi.string().trim().required(),
    email: Joi.string().email().required(),
    password: Joi.string().trim().required(),
    givenName: Joi.string().trim().required(),
    familyName: Joi.string().trim().required(),
    role: Joi.array().items(Joi.string().lowercase().trim()
    .valid('developer', 'quality analyst', 'business analyst', 'product manager', 'technical manager')),
    role: Joi.string().lowercase().trim()
    .valid('developer', 'quality analyst', 'business analyst', 'product manager', 'technical manager')
});
const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().trim().required()
});
const updateSchema = Joi.object({
    fullName: Joi.string().trim(),
    email: Joi.string().trim(),
    password: Joi.string().allow('', null).trim(),
    givenName: Joi.string().trim(),
    familyName: Joi.string().trim(),
    role: Joi.array()
        .items(Joi.string().lowercase().trim().valid(
            'developer', 'quality analyst', 'business analyst', 'product manager', 'technical manager'
        ))
        .min(1)
});
dotenv.config();
const router = express.Router();
const debugUser = debug('app:User');

router.use(express.urlencoded({extended:false}));

async function issueAuthToken(user) {
    const payload = {_id:user._id, email:user.email, role:user.role, name:user.fullName};
    const secret = process.env.JWT_SECRET;
    const options = {expiresIn:'1h'};
    const roles = await fetchRoles(user, role => findRoleByName(role));
    const perms = mergePermissions(user, roles);
    payload.permissions = perms;
    const authToken = Jwt.sign(payload, secret, options);  //? Creates the auth token
    return authToken;
}
function issueAuthCookie(res, authToken) {
    const cookieOptions = {httpOnly:true, maxAge:1000*60*60};
    res.cookie('authToken', authToken, cookieOptions);
}

//* GETs all users
router.get('/list', isLoggedIn(), hasPermission('canViewData'), async (req, res) => {
    let {keywords, role, minAge, maxAge, sortBy, pageSize, pageNum} = req.query;
    let sort = {givenName:1};
    const match = {};

    //? Filter through the requested queries
    if (keywords) {
        match.$text = {$search:keywords};
    }
    if (role) {
        match.role = {$eq:roles};
    }
    const today = new Date();
    today.setHours(0);
    today.setMinutes(0);
    today.setSeconds(0);
    today.setMilliseconds(0);

    const pastMaximumDaysOld = new Date(today);
    pastMaximumDaysOld.setDate(pastMaximumDaysOld.getDate() - maxAge); // Set pastMaximumDaysOld to today minus maxAge
    const pastMinimumDaysOld = new Date(today);
    pastMinimumDaysOld.setDate(pastMinimumDaysOld.getDate() - minAge); // Set pastMinimumDaysOld to today minus minAge

    if(maxAge && minAge){
      match.creationDate = {$lte:pastMinimumDaysOld, $gte:pastMaximumDaysOld};
    } else if(minAge){
      match.creationDate = {$lte:pastMinimumDaysOld};
    } else if(maxAge) {
      match.creationDate = {$gte:pastMaximumDaysOld};
    }

    switch (sortBy) {
        case 'givenName': sort = {givenName : 1, familyName : -1}; break;
        case 'familyName': sort = {givenName : -1, familyName : 1}; break;
        case 'role': sort = {role : 1, givenName : 1, creationDate : -1}; break;
        case 'newest': sort = {creationDate : -1}; break;
        case 'oldest': sort = {creationDate : 1}; break;
    }

    pageNum = parseInt(pageNum) || 1;
    pageSize = parseInt(pageSize) || 5;
    const skip = (pageNum-1)*pageSize;
    const limit = pageSize;
    const pipeline = [
        {$project:{"password":0}},
        {$match: match},
        {$sort: sort},
        {$skip: skip},
        {$limit: limit}
    ];

    try {
        const users = await getUsers(pipeline);
        if (users) {
            res.status(users.status).json(users.foundUsers);
        } else {
            res.status(users.status).json(users.message);
        }
        
    } catch (err) {
        res.status(400).json({error:err.stack});
    }
});
//* View yourself
router.get('/me', isLoggedIn(), async (req, res) => {
    try {
        const userResult = await getUserById(req.auth._id);
        if (userResult.status == 200) {
            res.status(userResult.status).json(userResult.foundUser);
        } else {
            res.status(userResult.status).json({message : userResult.message});
        }
        
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});
//* GETS user by id
router.get('/:userId', isLoggedIn(), hasPermission('canViewData'), validId("userId"), async (req, res) => {
    const userId = req.userId;
    try {
        const user = await getUserById(userId);
        if (user.foundUser) {
            res.status(user.status).json(user.foundUser);
        } else {
            res.status(user.status).json(user.message);
        }
        
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});
//* POST a new user
router.post('/register', removeEmptyStrings('role'), validBody(newUserSchema), async (req, res) => {
    const newUser = {
        _id : newId(),
        ...req.body,
        creationDate : new Date()
    };

    try {
        const result = await addNewUser(newUser);
        if (result.status == 200) {
            const authToken = await issueAuthToken(newUser);
            issueAuthCookie(res, authToken);
            const edit = createEdit("Insert", "User", newUser._id, newUser);
            await saveEdit(edit);
            debugUser(`Auth Token for ${newUser.fullName} is ${authToken}`);
        }
        res.status(result.status).json({message:result.message});
    } catch (err) {
        res.status(500).json({error:err.stack});
    }
});
//* POST user by email and password
router.post('/login', validBody(loginSchema), async (req, res) => {
    const {email, password} = req.body;
    try {
        const resultUser = await loginUser(email, password);
        if (resultUser.status == 200) {
            const authToken = await issueAuthToken(resultUser.foundUser);
            issueAuthCookie(res, authToken);
            debugUser(`Auth Token for ${resultUser.foundUser.fullName} is ${authToken}`);
        }
        res.status(resultUser.status).json({message:resultUser, authToken:req.auth});
    } catch (err) {
        res.status(500).json({error:err.stack});
    }
});
router.post('/logout', isLoggedIn(), async (req, res) => {
    res.clearCookie('authToken');
    res.status(200).json({message:'You have been logged out'});
});
//* Update yourself
router.put('/me', isLoggedIn(), validBody(updateSchema), async (req, res) => {
    const updatedUser = req.body;
    if (updatedUser.role) {
        res.status(400).json({message:"Can't modify role"});
		return;
	}
    if(updatedUser.password)
        updatedUser.password = await bcrypt.hash(updatedUser.password, 10);
    try {
        const updateResult = await updateUser(req.auth._id, updatedUser, "me",req);
        if (updateResult.status == 200) {
            const authToken = await issueAuthToken(await getUserById(req.auth._id));
            issueAuthCookie(res, authToken);
            const edit = createEdit("Self-Edit Update User", "User", req.auth._id, updatedUser, req.auth);
            const result = await saveEdit(edit);
            debugUser(JSON.stringify(req.auth));
        }
        res.status(updateResult.status).json({message:updateResult.message});
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});
//* Update User by ID
router.put('/:userId', isLoggedIn(), hasPermission('canEditAnyUser'), validId("userId"), 
validBody(updateSchema), async (req, res) => {
    const id = req.userId;
    const updatedUser = req.body;
    if (id == req.auth._id) {
        const authToken = await issueAuthToken(resultUser.foundUser);
        issueAuthCookie(res, authToken);
        debugUser(`Updating Yourself generating new token\n ${authToken}`);
    }
    if(updatedUser.password)
        updatedUser.password = await bcrypt.hash(updatedUser.password, 10);
    try {
        const result = await updateUser(id, updatedUser, "userId", req);
        debugUser(`Before: ${JSON.stringify(updatedUser)}`);
        delete updatedUser['update.lastUpdated'];
        delete updatedUser['update.lastUpdatedBy'];
        debugUser(`After: ${JSON.stringify(updatedUser)}`);
        if (result.status == 200) {
            const edit = createEdit("Update", "User", newId(id), req.body, req.auth);
            const editResult = await saveEdit(edit);
        }
        res.status(result.status).json({message:result.message});
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});
//* DELETE user by ID
router.delete('/:userId', isLoggedIn(), hasPermission('canEditUser'), validId("userId"), async (req, res) => {
    const id = req.userId;
    try {
        const deleteResult = await deleteUser(id);
        if (deleteResult.status == 200) {
            const edit = createEdit("Delete", "User", newId(id), null, req.auth);
            const editResult = await saveEdit(edit);
        }
        res.status(deleteResult.status).json({message:deleteResult.message});
    } catch (err) {
        res.status(400).json({error:err.stack});
    }
});

export {router as UserRouter};
