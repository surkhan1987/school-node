require('dotenv').config();
const mongoose = require("mongoose");
const { User, Branch } = require("./models");

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("Database connected");

    // Create default branch if it doesn't exist
    let defaultBranch = await Branch.findOne({ title: 'Main Branch' });
    if (!defaultBranch) {
      defaultBranch = new Branch({
        title: 'Main Branch'
      });
      await defaultBranch.save();
      console.log("Default branch created");
    }

    // Check if admin already exists
    let existingAdmin = await User.findOne({ username: 'admin' });
    if (existingAdmin) {
      // Update admin with branch if missing
      if (!existingAdmin.branch) {
        existingAdmin.branch = defaultBranch._id;
        await existingAdmin.save();
        console.log("Admin user updated with default branch");
      } else {
        console.log("Admin user already exists");
      }
      process.exit(0);
    }

    // Create admin user
    const adminUser = new User({
      username: 'admin',
      password: 'admin123', // Simple password for testing
      givenName: 'Administrator',
      familyName: 'User',
      type: 'admin',
      branch: defaultBranch._id,
      active: true
    });

    await adminUser.save();
    console.log("Admin user created successfully");
    console.log("Username: admin");
    console.log("Password: admin123");
    
    process.exit(0);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }
};

createAdmin();