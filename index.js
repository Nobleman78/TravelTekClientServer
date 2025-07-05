const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken'); // <-- JWT import
const port = process.env.PORT || 5000;
require('dotenv').config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oyt4s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        const userCollection = client.db('ClientInformation').collection('Users');
        const clientCollection = client.db('ClientInformation').collection('Clients');

        console.log('Connected to MongoDB');

        // JWT Related API
        app.post('/jwt', async (req, res) => {
            const { email } = req.body;
            const userInDb = await userCollection.findOne({ email });
            console.log(userInDb.email)

            if (!userInDb) {
                return res.status(401).send({ message: 'User not found' });
            }

            const tokenPayload = {
                email: userInDb.email,
                role: userInDb.role,
            };

            const token = jwt.sign(tokenPayload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send({ token });
        });

        // Middleware to verify JWT token
        const verifyToken = (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'Unauthorized access' });
            }
            const token = authHeader.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized access' });
                }
                req.decoded = decoded;
                console.log(req.decoded)
                next();
            });
        };

        // Middleware to verify Admin role
        const verifyAdmin = async (req, res, next) => {
            try {
                const email = req.decoded.email;
                const query = { email: email }
                const user = await userCollection.findOne(query);
                if (!user || user.role !== 'admin') {
                    return res.status(403).send({ message: 'Forbidden Access' });
                }
                next();
            } catch (error) {
                console.error('Error in verifyAdmin middleware:', error);
                res.status(500).send({ message: 'Internal Server Error' });
            }
        };


        // User Related APIs

        app.get('/users', async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'User Already Exist' });
            }

            // Assign role based on email
            if (user.email === 'jesminchakma@gmail.com') {
                user.role = 'admin';
            } else {
                user.role = 'user';
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        });


        // Client Related APIs
        // app.post('/client-information', async (req, res) => {
        //     const clientInfo = req.body;

        //     const timestampedClient = {
        //         ...clientInfo,
        //         createdAt: new Date().toISOString()
        //     };

        //     const result = await clientCollection.insertOne(timestampedClient);
        //     res.send(result);
        // });
        app.post('/client-information', async (req, res) => {
            const clientInfo = req.body;
            const { name, phoneNumber, purpose } = clientInfo;

            try {
                // Step 1: Check if phoneNumber number already exists
                const existingClient = await clientCollection.findOne({ phoneNumber });

                if (existingClient) {
                    // Step 2: If purpose is different, update it
                    if (existingClient.purpose.trim().toLowerCase() !== purpose.trim().toLowerCase()) {
                        const updateResult = await clientCollection.updateOne(
                            { phoneNumber },
                            {
                                $set: {
                                    purpose: purpose,
                                    updatedAt: new Date().toISOString()
                                }
                            }
                        );

                        return res.send({
                            message: 'Purpose updated for existing client.',
                            updated: true,
                            result: updateResult
                        });
                    } else {

                        return res.status(400).send({
                            message: 'Client with same phoneNumber and purpose already exists.',
                            duplicate: true
                        });
                    }
                }

                // Step 4: If not found, insert as new
                const timestampedClient = {
                    name,
                    phoneNumber,
                    purpose,
                    createdAt: new Date().toISOString()
                };

                const result = await clientCollection.insertOne(timestampedClient);

                res.send({
                    message: 'New client added successfully.',
                    inserted: true,
                    result
                });

            } catch (error) {
                console.error('Error in /client-information:', error);
                res.status(500).send({ error: 'Server error occurred.' });
            }
        });


        app.get('/client-information', verifyToken, verifyAdmin, async (req, res) => {
            try {
                const result = await clientCollection.find().toArray();
                const formatted = result.map(client => ({
                    ...client,
                    createdAt: client.createdAt
                        ? new Date(client.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })
                        : 'N/A'
                }));

                res.send(formatted);
            } catch (err) {
                console.error('Failed to fetch clients:', err);
                res.status(500).send({ error: 'Failed to fetch clients' });
            }
        });
    } catch (error) {
        console.error('MongoDB connection failed:', error);
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Server Is Running');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
