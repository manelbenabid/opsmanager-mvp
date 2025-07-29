import dotenv from 'dotenv';
dotenv.config(); 


import express, { Request , Response, NextFunction } from 'express';
import cors from 'cors'; // Import cors
import https from 'https'; // Import the https module
import fs from 'fs';     // Import the fs module to read certificate files
import path from 'path';   // Import path module for robust file paths
// import { fileURLToPath } from 'url'; // Import fileURLToPath
// import { dirname } from 'path';      // Import dirname
import admin from 'firebase-admin';
import {getEmployeeProfileDetails} from './services/employeeService';

// whether running from source code or from a packaged binary.
// const isPkg = typeof (process as any).pkg !== 'undefined';
// --- Get current directory in ES Modules ---
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

const isPkg = typeof (process as any).pkg !== 'undefined';
const envPath = isPkg
    ? path.join(path.dirname(process.execPath), '.env')
    : path.join(__dirname, '.env');

dotenv.config({ path: envPath });

// If in pkg, assets are relative to the executable. Otherwise, relative to the source structure.
const isCompiled = __dirname.includes('dist');
const projectRoot = isCompiled
    ? path.join(__dirname, '..', '..') // From .../backend/dist
    : path.join(__dirname, '..');       // From .../backend

// --- Asset Paths ---
const serviceAccountPath = path.join(projectRoot, 'backend', 'serviceAccountKey.json');
const keyPath = path.join(projectRoot, 'key.pem');
const certPath = path.join(projectRoot, 'cert.pem');
const frontendDistPath = path.join(projectRoot, 'dist'); 

// firebase
//const serviceAccountPath = path.join(__dirname, './serviceAccountKey.json');
let serviceAccount;
try {
    const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf-8');
    serviceAccount = JSON.parse(serviceAccountFile);
} catch (error) {
    console.error("CRITICAL: Service Account Key error at:", serviceAccountPath, error);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    //databaseURL: "https://mvp-ntw-operation-manager.firebaseio.com" // Optional: If using Realtime Database
});
const firestore = admin.firestore();

// Import your routers
import employeesRouter from './routes/employees';
import pocsRouter from './routes/pocs';
import customersRouter from './routes/customers';
import enumsRouter from './routes/enums';
import addressesRouter from './routes/addresses';
import pocEmployeesRouter from './routes/poc_employees';
import pocStatusCommentsRouter from './routes/poc_status_comments';
import pocCommentsRouter from './routes/poc_comments';
import projectsRouter from './routes/projects'; 
import projectEmployeesRouter from './routes/project_employees';
import projectStatusCommentsRouter from './routes/project_status_comments';
import projectCommentsRouter from './routes/project_comments';
import tasksRouter from './routes/tasks';
import pocActivityLogRouter from './routes/poc_activity_log';
import projectActivityLogRouter from './routes/project_activity_log'
import recentActivityRouter from './routes/recent_activity';
import attachmentsRouter from './routes/attachments';

const app = express();

// Middleware
app.use(cors()); // Enable CORS for all origins. For production, configure it more strictly.
app.use(express.json()); // To parse JSON request bodies

// It serves the built React app from the '/dist' folder.
app.use(express.static(frontendDistPath));

interface AuthenticatedRequest extends Request {
    user?: admin.auth.DecodedIdToken;
}
const verifyFirebaseToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send({ error: 'Unauthorized: No token provided.' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        if (!decodedToken.email) {
            return res.status(400).send({ error: 'User email not found in token.' });
        }

        const employeeDetails = await getEmployeeProfileDetails(decodedToken.email);
        if (!employeeDetails) {
            return res.status(404).send({ error: 'Employee record not found in database for this email.' });
        }
        req.user = {
            uid: decodedToken.uid, // Firebase UID
            email: decodedToken.email,
            // All details from your database, including the crucial 'id'
            ...employeeDetails,
        };
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(403).send({ error: 'Unauthorized: Invalid token.' });
    }
};

app.get('/api/auth/user-profile', verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
    const firebaseTokenUser = req.user;
    
    if (!firebaseTokenUser || !firebaseTokenUser.email) {
        return res.status(400).send({ error: 'User email not found in token.' });
    }

    try {
        // 1. Get role and optional username from Firestore users collection
        const userRoleDocRef = firestore.collection('users').doc(firebaseTokenUser.uid);
        // Path for Canvas environment might be:
        // const userRoleDocRef = firestore.collection(`artifacts/${process.env.APP_ID_FROM_CANVAS}/users`).doc(firebaseTokenUser.uid);
        // Ensure APP_ID_FROM_CANVAS is available as an env var if needed for this path.
        // For simplicity, using a direct 'users' collection path here.
        const userRoleDoc = await userRoleDocRef.get();
        let userRole = 'technical_team'; // Default role
        //let customUsername: string | undefined = undefined;

        if (userRoleDoc.exists) {
            const firestoreUserData = userRoleDoc.data();
            userRole = firestoreUserData?.role || userRole;
            //customUsername = firestoreUserData?.username;
        } else {
            // Optional: Create a default role entry in Firestore if it doesn't exist
            console.warn(`Role document not found for UID ${firebaseTokenUser.uid}. Using default role.`);
            // await userRoleDocRef.set({ email: firebaseTokenUser.email, role: userRole, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        }

        // 2. Get employee details from your on-premise database using email
        // THIS IS PSEUDOCODE - replace with your actual on-premise DB logic
        const employeeDetails = await getEmployeeProfileDetails(firebaseTokenUser.email);
        if (!employeeDetails) {
           return res.status(404).send({ error: 'Employee record not found in on-premise DB for this email.' });
         }
        // Mocked on-premise data for example:
        


        // 3. Combine and return the profile
        const combinedUserProfile = {
            email: firebaseTokenUser.email,
            applicationRole: userRole,           // From Firestore
            ...employeeDetails, // Data from your on-premise DB
        };

      res.json(combinedUserProfile);

    } catch (error) {
        console.error("Error constructing user profile:", error);
        res.status(500).send({ error: "Failed to retrieve user profile." });
    }
});

app.use('/api/employees', verifyFirebaseToken, employeesRouter);
app.use('/api/customers', verifyFirebaseToken, customersRouter);
app.use('/api/addresses', verifyFirebaseToken, addressesRouter);
app.use('/api/poc-employees', verifyFirebaseToken, pocEmployeesRouter);
app.use('/api/poc-status-comments', verifyFirebaseToken, pocStatusCommentsRouter);
app.use('/api/poc-comments', verifyFirebaseToken, pocCommentsRouter);
app.use('/api/pocs', verifyFirebaseToken, pocsRouter);
app.use('/api/enums', verifyFirebaseToken, enumsRouter);
app.use('/api/projects', verifyFirebaseToken, projectsRouter); 
app.use('/api/project-status-comments', verifyFirebaseToken, projectStatusCommentsRouter);
app.use('/api/project-comments', verifyFirebaseToken, projectCommentsRouter);
app.use('/api/project-employees', verifyFirebaseToken, projectEmployeesRouter);
app.use('/api/tasks', verifyFirebaseToken,  tasksRouter);
app.use('/api/poc-activity-log', verifyFirebaseToken, pocActivityLogRouter);
app.use('/api/project-activity-log', verifyFirebaseToken, projectActivityLogRouter);
app.use('/api/recent-activity', verifyFirebaseToken, recentActivityRouter); 
app.use('/api/attachments', verifyFirebaseToken, attachmentsRouter); 

// It serves the index.html for any non-API request, allowing client-side routing to work.
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
});



// --- Server Configuration ---
const port = 3001; // Your backend API port
const host = '10.65.99.71'; // Your host IP

// Middleware to verify Firebase ID token


// --- HTTPS Configuration ---
// Define paths to your SSL certificate and private key
// IMPORTANT: Replace these with the actual paths to your certificate and key files.
// For development, you might place them in the root of your project or a 'certs' folder.

// const keyPath = path.join(__dirname, '../key.pem'); // Assumes server.key is in the same directory as your compiled index.js
// const certPath = path.join(__dirname, '../cert.pem'); // Assumes server.crt is in the same directory

// Check if certificate files exist
if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('Error: SSL certificate or key file not found.');
  console.error(`Please ensure 'server.key' and 'server.crt' exist at the specified paths:`);
  console.error(`Key Path: ${keyPath}`);
  console.error(`Cert Path: ${certPath}`);
  console.error('Generate them using OpenSSL or obtain them from a CA.');
  console.error('For development, you can use OpenSSL to create self-signed certificates:');
  console.error('  openssl genrsa -out server.key 2048');
  console.error('  openssl req -new -key server.key -out server.csr');
  console.error('  openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt');
  process.exit(1); // Exit if files are not found
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};



// Create an HTTPS server instead of an HTTP server
https.createServer(httpsOptions, app).listen(port, host, () => {
  console.log(`Backend API listening at https://${host}:${port}`);
});
