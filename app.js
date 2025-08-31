const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const marked = require('marked');
const matter = require('gray-matter');

// markedの非推奨警告を無効化
marked.setOptions({
    mangle: false,
    headerIds: false
});

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 本番環境での設定
if (NODE_ENV === 'production') {
    app.set('trust proxy', 1);
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// 静的ファイルの設定
app.use('/static', express.static(path.join(__dirname, 'public')));

// EJSをテンプレートエンジンとして設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ブログ記事を読み込む関数
async function loadPosts() {
    try {
        const postsDir = path.join(__dirname, 'posts');
        const files = await fs.readdir(postsDir);
        const posts = [];

        for (const file of files) {
            if (path.extname(file) === '.md') {
                const filePath = path.join(postsDir, file);
                const fileContent = await fs.readFile(filePath, 'utf-8');
                const { data, content } = matter(fileContent);
                
                posts.push({
                    slug: path.basename(file, '.md'),
                    title: data.title || 'Untitled',
                    date: data.date || new Date(),
                    content: content,
                    excerpt: content.substring(0, 150) + '...'
                });
            }
        }

        // 日付順でソート（新しい順）
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        return posts;
    } catch (error) {
        console.error('記事の読み込みエラー:', error);
        return [];
    }
}

// ホームページ（記事一覧）
app.get('/', async (req, res) => {
    const allPosts = await loadPosts();
    const page = parseInt(req.query.page) || 1;
    const perPage = 5; // 1ページあたりの表示件数
    const totalPosts = allPosts.length;
    const totalPages = Math.ceil(totalPosts / perPage);
    
    // ページ番号の範囲チェック
    if (page < 1 || (page > totalPages && totalPages > 0)) {
        return res.redirect('/?page=1');
    }
    
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const posts = allPosts.slice(startIndex, endIndex);
    
    res.render('index', { 
        title: 'ism魂',
        descripiton: '日常の出来事や散歩日記なんか書いてくブログ',
        posts: posts,
        pagination: {
            currentPage: page,
            totalPages: totalPages,
            totalPosts: totalPosts,
            perPage: perPage,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
            prevPage: page - 1,
            nextPage: page + 1
        }
    });
});

// 個別記事ページ
app.get('/post/:slug', async (req, res) => {
    const posts = await loadPosts();
    const post = posts.find(p => p.slug === req.params.slug);
    
    if (!post) {
        return res.status(404).render('404', { title: '記事が見つかりません' });
    }
    
    // MarkdownをHTMLに変換
    const htmlContent = marked.parse(post.content);
    
    res.render('post', { 
        title: post.title + ' - ism魂',
        post: { ...post, htmlContent }
    });
});

// 404エラーページ
app.use((req, res) => {
    res.status(404).render('404', { title: 'ページが見つかりません' });
});

app.listen(PORT, () => {
    console.log(`ブログサーバーが http://localhost:${PORT} で起動しました`);
});