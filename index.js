const express = require('express');
const app = express();
const cors = require('cors');
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
        const clientCollection = client.db('ClientInformation').collection('Clients');
        const userCollection = client.db('ClientInformation').collection('Users');

        // User Related Api

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingEmail = await userCollection.findOne(query)
            if (existingEmail) {
                return res.send({ message: 'User Already Exist' })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)

        })
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })


        //  Client Related API
        app.post('/client-information', async (req, res) => {
            const user = req.body;

            const timestampedUser = {
                ...user,
                createdAt: new Date().toISOString()
            };

            const result = await clientCollection.insertOne(timestampedUser);
            res.send(result);
        });

        app.get('/client-information', async (req, res) => {
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

        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
    }
    finally {

    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Server Is Running');
});


app.listen(port, () => {
    console.log(`Server is running on ${port}`)
})
