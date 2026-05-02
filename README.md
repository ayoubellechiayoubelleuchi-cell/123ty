# 123ty — مشروعي (مبيعات يومية)

## الربط بـ GitHub

| العنصر | القيمة |
|--------|--------|
| **المستودع** | https://github.com/ayoubellechiayoubelleuchi-cell/123ty |
| **الفرع المعتمد** | `main` |
| **الموقع الحي (Vercel)** | https://123ty.vercel.app |

النسخة المحلية `@c:\progakt` معدّة بحيث:

```text
git remote -v
# origin → https://github.com/ayoubellechiayoubelleuchi-cell/123ty.git
```

## سير العمل (كل تعديل → GitHub → Vercel)

1. عدّل الملفات (مثلاً `app.js`، `index.html`).
2. عند تغيير `app.js` حدّث في `index.html` قيمة **`app.js?v=...`** لتفادي كاش المتصفح.
3. ادفع إلى `main`:

   ```bash
   git add .
   git commit -m "وصف مختصر للتغيير"
   git push origin main
   ```

4. في [لوحة Vercel](https://vercel.com/dashboard) تُبنى نسخة جديدة تلقائيًا إن كان المشروع متصلاً بهذا المستودع على GitHub.

## الملفات المهمة

- `index.html` — الواجهة
- `app.js` — المنطق والمزامنة (Supabase)
- `supabase-js-v2.min.js` — عميل Supabase
- `vercel.json` — رؤوس التخزين المؤقت
- `supabase_setup.sql` — مرجع قاعدة البيانات

## استنساخ على جهاز آخر

```bash
git clone https://github.com/ayoubellechiayoubelleuchi-cell/123ty.git
cd 123ty
```

ثم افتح المشروع عبر خادم محلي (مثل `npx serve`) أو انشر إلى Vercel من نفس الحساب.
