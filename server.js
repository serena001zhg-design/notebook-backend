const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 连接 MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB 连接成功'))
  .catch(err => console.error('MongoDB 连接失败:', err));

// 数据模型
const FolderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  isOpen: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const FileSchema = new mongoose.Schema({
  name: String,
  size: Number,
  type: String,
  data: String, // Base64 数据
  isImage: Boolean
});

const NoteSchema = new mongoose.Schema({
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' },
  title: { type: String, default: '新笔记' },
  content: { type: String, default: '<p>开始写作...</p>' },
  files: [FileSchema],
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const Folder = mongoose.model('Folder', FolderSchema);
const Note = mongoose.model('Note', NoteSchema);

// ========== 文件夹 API ==========

// 获取所有文件夹
app.get('/api/folders', async (req, res) => {
  try {
    const folders = await Folder.find().sort({ createdAt: 1 });
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建文件夹
app.post('/api/folders', async (req, res) => {
  try {
    const folder = new Folder({ name: req.body.name });
    await folder.save();
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除文件夹
app.delete('/api/folders/:id', async (req, res) => {
  try {
    await Folder.findByIdAndDelete(req.params.id);
    // 将该文件夹下的笔记移到默认文件夹
    const defaultFolder = await Folder.findOne().sort({ createdAt: 1 });
    if (defaultFolder) {
      await Note.updateMany(
        { folderId: req.params.id },
        { folderId: defaultFolder._id }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== 笔记 API ==========

// 获取某个文件夹的所有笔记
app.get('/api/folders/:folderId/notes', async (req, res) => {
  try {
    const notes = await Note.find({ folderId: req.params.folderId })
                            .sort({ updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取所有笔记
app.get('/api/notes', async (req, res) => {
  try {
    const notes = await Note.find().sort({ updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建笔记
app.post('/api/notes', async (req, res) => {
  try {
    const note = new Note({
      folderId: req.body.folderId,
      title: req.body.title || '新笔记',
      content: req.body.content || '<p>开始写作...</p>'
    });
    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新笔记
app.put('/api/notes/:id', async (req, res) => {
  try {
    const note = await Note.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title,
        content: req.body.content,
        files: req.body.files,
        updatedAt: new Date()
      },
      { new: true }
    );
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除笔记
app.delete('/api/notes/:id', async (req, res) => {
  try {
    await Note.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 上传文件到笔记
app.post('/api/notes/:id/files', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ error: '笔记不存在' });
    }
    
    note.files.push(req.body.file);
    note.updatedAt = new Date();
    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除笔记中的文件
app.delete('/api/notes/:noteId/files/:fileId', async (req, res) => {
  try {
    const note = await Note.findById(req.params.noteId);
    if (!note) {
      return res.status(404).json({ error: '笔记不存在' });
    }
    
    note.files = note.files.filter(f => f._id.toString() !== req.params.fileId);
    note.updatedAt = new Date();
    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 初始化默认文件夹
async function initDefaultFolder() {
  const count = await Folder.countDocuments();
  if (count === 0) {
    await new Folder({ name: '我的笔记' }).save();
    console.log('已创建默认文件夹');
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`服务器运行在端口 ${PORT}`);
  await initDefaultFolder();
});