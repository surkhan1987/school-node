const { Schema, model, Types } = require("mongoose");

module.exports.User = model(
  "User",
  new Schema(
    {
      username: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      givenName: { type: String, required: true },
      familyName: { type: String },
      imageUrl: { type: String, default: "/files/application/user-avatar.jpg" },
      type: { type: String },
      active: { type: Boolean, default: true },
      branch: { type: Types.ObjectId, ref: "Branch" },
      lastLogin: { type: Date },
    },
    { timestamps: true }
  )
);

module.exports.Branch = model(
  "Branch",
  new Schema(
    {
      title: { type: String },
    },
    { timestamps: true }
  )
);

module.exports.Group = model(
  "Group",
  new Schema(
    {
      title: { type: String },
      students: [{ type: Types.ObjectId, ref: "User" }],
      branch: { type: Types.ObjectId, ref: "Branch" },
    },
    { timestamps: true }
  )
);

module.exports.Transfer = model(
  "Transfer",
  new Schema(
    {
      student: { type: Types.ObjectId, ref: "User" },
      fromGroup: { type: Types.ObjectId, ref: "Group" },
      toGroup: { type: Types.ObjectId, ref: "Group" },
      date: { type: Date },
    },
    { timestamps: true }
  )
);

module.exports.Discipline = model(
  "Discipline",
  new Schema(
    {
      title: { type: String },
      branch: { type: Types.ObjectId, ref: "Branch" },
    },
    { timestamps: true }
  )
);

module.exports.Connection = model(
  "Connection",
  new Schema(
    {
      teacher: { type: Types.ObjectId, ref: "User" },
      discipline: { type: Types.ObjectId, ref: "Discipline" },
      group: { type: Types.ObjectId, ref: "Group" },
      active: { type: Boolean, default: true },
      branch: { type: Types.ObjectId, ref: "Branch" },
    },
    { timestamps: true }
  )
);

module.exports.Lesson = model(
  "Lesson",
  new Schema(
    {
      title: { type: String },
      connection: { type: Types.ObjectId, ref: "Connection" },
      hours: { type: Types.ObjectId, ref: "Hours" },
      date: { type: Date },
      type: { type: String, default: "simple" }, //exam
      homework: { type: String },
      homeworkStart: { type: Date },
      homeworkEnd: { type: Date },
      active: { type: Boolean, default: false },
    },
    { timestamps: true }
  )
);

module.exports.Score = model(
  "Score",
  new Schema(
    {
      lesson: { type: Types.ObjectId, ref: "Lesson" },
      student: { type: Types.ObjectId, ref: "User" },
      teacher: { type: Types.ObjectId, ref: "User" },
      assign: { type: String, default: null },
      score: { type: Number, default: null },
      behavior: { type: Number, default: null },
      weeklyExam: { type: Number, default: null },
      monthlyExam: { type: Number, default: null },
      homework: { type: Number, default: null },
      attend: { type: Boolean, default: null },
    },
    { timestamps: true }
  )
);

module.exports.Hours = model(
  "Hours",
  new Schema(
    {
      startTime: { type: Date },
      endTime: { type: Date },
      branch: { type: Types.ObjectId, ref: "Branch" },
    },
    { timestamps: true }
  )
);

module.exports.Quarter = model(
  "Quarter",
  new Schema(
    {
      startDate: { type: Date },
      endDate: { type: Date },
      branch: { type: Types.ObjectId, ref: "Branch" },
    },
    { timestamps: true }
  )
);

module.exports.Pricing = model(
  "Pricing",
  new Schema(
    {
      month: { type: String },
      price1: { type: Number },
      price2: { type: Number },
      price3: { type: Number },
      branch: { type: Types.ObjectId, ref: "Branch" },
    },
    { timestamps: true }
  )
);

module.exports.Pay = model(
  "Pay",
  new Schema(
    {
      amount: { type: Number },
      discount: { type: Number },
      type: { type: String },
      sPrice: { type: String, default: "price1" },
      pricing: { type: Types.ObjectId, ref: "Pricing" },
      student: { type: Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
  )
);

module.exports.Finance = model(
  "Finance",
  new Schema(
    {
      type: { type: String, required: true },
      source: { type: String },
      amount: { type: Number, required: true },
      description: { type: String },
      user: { type: Types.ObjectId, ref: "User" },
      branch: { type: Types.ObjectId, ref: "Branch" },
    },
    { timestamps: true }
  )
);

module.exports.KPI = model(
  "KPI",
  new Schema(
    {
      month: { type: String },
      teacher: { type: Types.ObjectId, ref: "User" },
      participation: { type: Number, default: null },
      certificate: { type: Number, default: null },
      attend: { type: Number, default: null },
    },
    { timestamps: true }
  )
);
