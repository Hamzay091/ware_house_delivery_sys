/**
 * Runs the whole app against a throwaway in-memory MongoDB, seeded with demo
 * data — no database install, no .env, nothing to clean up afterwards.
 *
 *   npm run demo
 *
 * The data lives only in memory and disappears when the process exits.
 */
const crypto = require('crypto');

async function main() {
    let MongoMemoryServer;
    try {
        ({ MongoMemoryServer } = require('mongodb-memory-server'));
    } catch (err) {
        console.error('❌ mongodb-memory-server is not installed. Run: npm install');
        process.exit(1);
    }

    console.log('⏳ Starting a temporary in-memory MongoDB (first run downloads it)...');
    const mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri('warehouseDB');

    process.env.MONGO_URI = uri;
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';
    process.env.SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(48).toString('hex');
    process.env.PORT = process.env.PORT || '3000';

    const mongoose = require('mongoose');
    await mongoose.connect(uri);

    const seed = require('./seed');
    await seed({ force: true });

    const app = require('../server');
    const port = Number(process.env.PORT);
    const server = app.listen(port, () => {
        console.log(`\n🚀 Demo running at http://localhost:${port}`);
        console.log('   admin@apex.test · manager@apex.test · driver@apex.test');
        console.log('   Password: apexdemo123\n');
    });

    const shutdown = async () => {
        console.log('\n👋 Shutting the demo down...');
        server.close();
        await mongoose.disconnect().catch(() => {});
        await mongo.stop().catch(() => {});
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch(err => {
    console.error('❌ Demo failed to start:', err);
    process.exit(1);
});
