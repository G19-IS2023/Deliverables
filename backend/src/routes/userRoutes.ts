import express, { Request, Response} from 'express';
import User from '../models/user';
import { DatabaseService } from '../services/database';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import LibraryEntry from '../models/library';
import { verifyToken } from './verifyToken';

const router = express.Router();

const databaseService = DatabaseService.getInstance();


//API per inviare l'User
router.get('/getUser/:userId', async(req: Request, res: Response) => {

    try{

        const db = await databaseService.getDb();
        const userId: string = req.params.userId;

        const user = await db?.collection("users").findOne( { _id: new ObjectId(userId) } ) as User | null;
        
        if(user) {
            res.status(200).json(user);
        } else {
            res.status(404).send("User not found");
        }

    }catch(error: any) {
        res.status(400).send("Cannot complete the task");
    }
    
});


//API per verificare le credenziali e inviare l'accessToken
router.post('/login', async(req: Request, res: Response) => {

    const db = await databaseService.getDb();

    const searchEmail: string = req.body.email;

    const possibleUser = await db?.collection("users").findOne({email: searchEmail }) as User | null;
    
    if(!possibleUser) { 
        return res.status(404).send('Cannot find user');
    }

    try {

        if(await bcrypt.compare(req.body.password, possibleUser.password)) {

            const accessToken = jwt.sign({ email: possibleUser.email, _id: possibleUser._id }, process.env.ACCESS_TOKEN_SECRET!);
            res.status(200).json({ accessToken: accessToken, userId: possibleUser._id });
        } else {
            
            res.status(403).send('Wrong password');
        }
    } catch (error: any) {
        res.status(500).send('Server error');
    }
});


//API per registrare l'User e criptare la password
router.post('/register', async (req: Request, res: Response) => {

    
    try{ 
        const name: string = req.body.name;
        const email: string = req.body.email;
        const password: string = req.body.password;
        const predLibrary: LibraryEntry = {libName: "Default", libId: "1", books: []};
        const library: LibraryEntry[] = [predLibrary]; //Setta libreria predefinita
        const objectId: string = req.body.userId;
        
       if(ObjectId.isValid(objectId)) {
        
            const userId: ObjectId = new ObjectId(objectId);
            const salt = await bcrypt.genSalt();
            const hashedPassword = await bcrypt.hash(password, salt) as string;
            const user = new User(name, email, hashedPassword, library, userId) as User | null;
            
            const db = await databaseService.getDb();

            const existEmail = await db?.collection('users').findOne({ email: email  }) as User | null;
            const existUsername = await db?.collection('users').findOne({ name: name  }) as User | null;

            if(!existEmail) {
                if(!existUsername) {
                    
                    if(user) {
                    const result = await db?.collection("users").insertOne(user);

                    res.status(201).json(result);

                    } else {
                        res.status(400).send('User not created');
                    }
                } else { 
                    res.status(400).send('Username already exists');
                }
            } else {
                res.status(409).send('Email already used');
            }
        } else {
            res.status(404).send('Invalid user id');
        }

    }catch(error: any) {
        res.status(401).send("Cannot complete the task");
    }
});


//API per modificare l'username
router.put('/modifyUsername', verifyToken, async (req: Request, res: Response) => {

    try {

        const userId: string = req.body.userId;
        const newUsername: string = req.body.newUsername;

        const db = await databaseService.getDb();

        const existUsername = await db?.collection('users').findOne({ name: newUsername  }) as User | null;

        if(!existUsername){

            await db?.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: { username: newUsername } });
            res.status(200).send('Succesfully updated');
        }
            
    } catch(error: any) {
        res.status(400).send("Cannot complete the task");
    }
});


//API per modificare la password
router.put('/modifyPassword', verifyToken, async (req: Request, res: Response) => {

    try {
        const userId: string = req.body.userId;
        const oldPassword: string = req.body.oldPassword;
        const newPassword: string = req.body.newPassword;

        const db = await databaseService.getDb();
        const user = await db?.collection("users").findOne({ _id: new ObjectId(userId) }) as User | null;

        if(!user) {
            res.status(401).send('Cannot find the user');
            return;
        }
        if(await bcrypt.compare(oldPassword, user.password)) {

            const salt = await bcrypt.genSalt();
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            await db?.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: { password: hashedPassword } });
            res.status(200).send('Succesfully updated');
            } else {

                res.status(403).send('Old password is incorrect');
            }

    } catch(error: any) {
        res.status(400).send("Cannot complete the task");
    }
});


//API per eliminare l'account
router.delete("/deleteProfile/:userId", verifyToken, async (req: Request, res: Response) => {

    try {

        const userId: string = req.params.userId;

        const db = await databaseService.getDb();
        const user = await db?.collection("users").findOne( { _id: new ObjectId(userId) } ) as User | null;

        if(!user) {
            res.status(401).send('Cannot find user');
            return;
        }

        await db?.collection('users').deleteOne({ _id: new ObjectId(userId) });
        res.status(200).send('Succesfully deleted');

    } catch(error: any) {

        res.status(400).send("Cannot complete the task");
    }


});

export { router as userRouter };