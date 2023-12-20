import * as dotenv from "dotenv"
import express from 'express';
import debug from 'debug';
import Joi from "joi";
import { getBugEditsByUserId } from "../../database.js";
import {validId} from '../../middleware/validId.js';
import {validBody} from '../../middleware/validBody.js';
import {isLoggedIn, hasPermission} from "@merlin4/express-auth";

dotenv.config();
const router = express.Router();
const debugTests = debug('app:Test');
router.use(express.urlencoded({extended:false}));

router.get('/:userId', isLoggedIn(), hasPermission('canViewData'), validId("userId"), async (req, res) => {
    const id = req.userId;
    try {
        const tests = await getBugEditsByUserId(id);
        if (tests.length > 0) {
            res.status(200).json({tests:tests});
        } else {
            res.status(400).json({tests:tests});
        }
    } catch (err) {
        res.status(500).json({error: err.stack});
    }
});

export {router as EditRouter};