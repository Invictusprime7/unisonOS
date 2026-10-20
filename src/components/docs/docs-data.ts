import {
  BookOpen,
  Layout,
  Users,
  Palette,
  Cloud,
  FolderOpen,
  Workflow,
  Rocket,
  Sparkles,
  Globe,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";

export interface DocSection {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  image: string;
  articles: DocArticle[];
}

export interface DocArticle {
  id: string;
  title: string;
  content: string;
  image?: string;
}

export const docSections: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: BookOpen,
    description: "Your first steps with Unison",
    image: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=200&fit=crop",
    articles: [
      {
        id: "platform-overview",
        title: "Welcome to Unison",
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=300&fit=crop",
        content: `# Welcome to Unison 👋

Unison turns a few answers about your business into a finished, working website — and then keeps running the business behind it.

## What Unison Is For

Most tools give you a blank template and wish you luck. Unison starts from your business: what you do, who you serve, and what you want people to do when they arrive.

**🚀 Launch a complete site**
Answer four questions in the Launch Wizard and get a real multi-page site — written for your business, styled as one, with buttons that actually do something.

**✍️ Edit by describing**
Tell the assistant what to change in plain English, or click any part of the page and edit it directly.

**📅 Take real bookings and orders**
Appointments, enquiries, quotes, carts and checkouts are real working features, not pictures of features.

**👥 Keep your customers**
Every enquiry and booking lands in your customer list, ready to follow up.

**🌍 Publish and grow**
Go live on your own web address, then keep editing. Visitors see updates within moments.

## Your First Hour

1. **Run the Launch Wizard** — four questions, one finished site.
2. **Look through every page** — they are all written for your business already.
3. **Fix the details** — real photos, real prices, real opening hours.
4. **Switch on what you sell** — bookings, payments or enquiries.
5. **Publish** — your site goes live on its own address.

## Quick Tip 💡

Do not treat the first result as a draft to rebuild. It is meant to be nearly right — change what is wrong, keep the rest.`,
      },
      {
        id: "who-uses-unison",
        title: "What People Use Unison For",
        image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&h=300&fit=crop",
        content: `# What People Use Unison For 🧭

Unison is built for businesses that need a site that *works*, not just one that looks nice.

## Salons, Spas and Studios

Services with prices, a gallery that shows the work, and a booking page that takes real appointments without double-booking you.

## Restaurants and Cafés

A menu that is easy to keep current, photography that carries the room, and reservations that reach you instantly.

## Shops and Makers

A product catalogue, a cart, and a checkout that takes payment. Orders arrive with the customer's details attached.

## Contractors and Local Services

Projects with before-and-after proof, service areas, and a quote request form that turns into a lead you can chase.

## Agencies, Studios and Portfolios

Case studies, a cinematic gallery, and a contact route that treats an enquiry like a brief.

## Coaches and Consultants

Programmes, a booking flow for discovery calls, and a list people can join.

## Nonprofits

A cause page that explains the work, and donations that actually process.

## Agencies Building for Clients

Launch a client site in minutes, hand over a version you can reproduce exactly, and keep every project separate and private.

## Quick Tip 💡

Not listed? Pick the closest one in the Wizard. The pages and wording follow your business description, not the label.`,
      },
      {
        id: "dashboard-guide",
        title: "Using Your Dashboard",
        image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=300&fit=crop",
        content: `# Your Dashboard — Command Central 🎯

The Dashboard is where you'll spend most of your time. Think of it as your personal command center where you can see everything at a glance.

## What You'll See

When you open the Dashboard, you'll find:

**Your Projects**
All your work, organized in neat cards. Each card shows the project name and how many tasks are inside.

**Quick Action Buttons**
Big, friendly buttons at the top to create new projects or tasks with one click.

## How to Create a Project

1. Click the **"New Project"** button (it has a + sign)
2. Give your project a name (like "My Website" or "Marketing Ideas")
3. Click **Create** — that's it!

## How to Add Tasks

1. Click on any project to open it
2. Click **"Add Task"**
3. Type what you need to do
4. Set a due date if you want a reminder
5. Click **Save**

## Helpful Tips 💡

**Keep it simple**: Start with just one or two projects. You can always add more later.

**Use clear names**: "Website Redesign" is better than "Project 1" — you'll thank yourself later!

**Check in daily**: Spend 2 minutes each morning looking at your tasks. It helps you stay focused.

## What Do the Colors Mean?

- **Green** = Completed! Great job! 🎉
- **Yellow** = Due soon — better get on it!
- **Red** = Overdue — needs your attention now`,
      },
      {
        id: "pricing-plans",
        title: "Choosing Your Plan",
        image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=300&fit=crop",
        content: `# Which Plan is Right for You? 💰

We have three simple plans. Start free and upgrade whenever you're ready!

## 🆓 Free Plan — $0/month

Perfect for trying things out or personal projects.

**What you get:**
- 1 project to work on
- Create 10 AI designs per month
- Basic templates to get started
- 100MB of file storage (enough for lots of images!)

**Best for:** Individuals just getting started or testing the platform.

## ⭐ Pro Plan — $29/month

Our most popular choice! Great for freelancers and small businesses.

**What you get:**
- Unlimited projects — create as many as you need
- 500 AI designs per month
- All our premium templates
- Priority support (we respond faster!)
- Up to 5 team members
- Use your own website address
- 10GB of storage

**Best for:** Freelancers, small business owners, and growing teams.

## 🏢 Business Plan — $99/month

For agencies and larger teams who need the full power.

**What you get:**
- Everything in Pro, plus...
- Unlimited AI designs
- Remove our branding completely
- A dedicated person to help you
- Unlimited team members
- Extra security features
- 100GB of storage

**Best for:** Agencies, enterprises, and teams with big ambitions.

## Common Questions

**Can I change plans later?**
Absolutely! Upgrade or downgrade anytime. We'll adjust your bill automatically.

**Is there a free trial for Pro?**
Yes! You get 14 days free to try Pro before paying.

**What if I need help choosing?**
Just reach out — we're happy to help you find the right fit!`,
      },
    ],
  },
  {
    id: "web-builder",
    title: "Website Builder",
    icon: Layout,
    description: "Create beautiful websites easily",
    image: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=400&h=200&fit=crop",
    articles: [
      {
        id: "web-builder-intro",
        title: "Building Your First Website",
        image: "https://images.unsplash.com/photo-1547658719-da2b51169166?w=600&h=300&fit=crop",
        content: `# Build a Website in Minutes! 🌐

No coding needed. No technical skills required. If you can use a word processor, you can build a website!

## How It Works

**1. Pick a Starting Point**
Choose from our ready-made templates. They're professionally designed, so you already look great!

**2. Make It Yours**
Click on any text to change it. Click on images to swap them out. Drag things around until you love it.

**3. Preview & Publish**
See exactly how your site looks on phones and computers. When you're happy, hit publish!

## Step-by-Step: Your First Website

**Step 1: Open Web Builder**
From the home page, click the "Website Builder" card.

**Step 2: Choose a Template**
Browse the templates. See one you like? Click it!
- Business templates for companies
- Portfolio templates for creatives
- Simple templates for personal sites

**Step 3: Edit the Text**
Click on any text on the page. A box appears where you can type your own words.

**Step 4: Change Images**
Click on any image. You can:
- Upload your own photos
- Choose from our free image library
- Use AI to generate images!

**Step 5: Preview**
Click the "Preview" button to see your site. Check how it looks on:
- Desktop computers
- Tablets
- Mobile phones

**Step 6: Publish!**
Happy with it? Click "Publish" and your website is live!

## Tips for a Great Website 💡

**Less is more**: Don't crowd your pages. Give things room to breathe.

**Use quality images**: Blurry photos make your site look unprofessional.

**Keep text short**: Most visitors skim. Use short paragraphs and bullet points.

**Test on your phone**: More than half of visitors will see your site on mobile!`,
      },
      {
        id: "ai-page-generator",
        title: "Let AI Design For You",
        image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=300&fit=crop",
        content: `# AI-Powered Design Magic ✨

Not sure where to start? Just tell our AI what you want, and it'll create a page for you!

## How Simple Is It?

Really simple. Here's all you do:

1. **Describe what you need** — Type something like "A homepage for my bakery with photos of our pastries"

2. **Click Generate** — Wait a few seconds while the magic happens

3. **Customize it** — The AI gives you a starting point. Tweak it to make it perfect!

## What to Include in Your Description

The more details you give, the better the results. Try including:

- **What your business does**: "I sell handmade jewelry"
- **The style you want**: "Modern and clean" or "Warm and cozy"
- **Key sections**: "Include a gallery, about section, and contact form"
- **Your colors**: "Use blue and white" (optional — AI can choose for you!)

## Example Prompts That Work Great

**For a restaurant:**
"Create a restaurant homepage with our menu, photos of food, location map, and a reservation button. Warm, inviting colors."

**For a portfolio:**
"Design a portfolio page for a photographer. Include a gallery grid, about me section, and contact info. Minimal and elegant."

**For a service business:**
"Build a landing page for a house cleaning service. Show our services, pricing, customer reviews, and a booking button."

## Good to Know 💡

**You can always edit**: AI gives you a head start. You're in control of the final result.

**Try different descriptions**: Not happy? Generate again with different words.

**It counts toward your plan**: Each generation uses one of your monthly AI credits.`,
      },
      {
        id: "creatives-gallery",
        title: "Your Creative Assets",
        image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=300&fit=crop",
        content: `# All Your Creative Files in One Place 🎨

The Creatives Gallery is like a digital filing cabinet for all your visual stuff — images, designs, templates, and more.

## What Goes Here?

Everything visual that you create or upload:

- **Photos** — Pictures for your website, social media, etc.
- **Graphics** — Logos, icons, banners you've designed
- **Templates** — Page designs you want to reuse
- **Documents** — PDFs, presentations, reports

## How to Stay Organized

**Create Folders**
Just like on your computer! Make folders like:
- "Website Images"
- "Social Media Posts"
- "Client Logos"

**Add Favorites**
See a file you use often? Click the star to favorite it. Favorites appear at the top so you can find them quickly.

**Use the Search**
Can't remember where you put something? Just type in the search box. We'll find it for you.

## Uploading Files

**Drag and Drop**
The easiest way! Just drag files from your computer and drop them in the gallery.

**Click to Browse**
Click the upload button and select files from your computer.

**Upload Many at Once**
Select multiple files and upload them all together. No need to do one at a time!

## Sharing With Others

Need to share a file with a teammate?
1. Click on the file
2. Click "Share"
3. Copy the link and send it

That's it! They can view or download it.`,
      },
    ],
  },
  {
    id: "design-studio",
    title: "Design Studio",
    icon: Palette,
    description: "Create graphics like a pro",
    image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=200&fit=crop",
    articles: [
      {
        id: "design-studio-overview",
        title: "Creating Beautiful Designs",
        image: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=600&h=300&fit=crop",
        content: `# Design Like a Pro — No Experience Needed! 🎨

The Design Studio helps you create professional graphics for anything — social media, business cards, flyers, presentations, and more.

## What Can You Create?

**Social Media Posts**
Perfect-sized images for Instagram, Facebook, Twitter, LinkedIn — you name it!

**Business Materials**
Business cards, letterheads, envelopes — look professional in print.

**Marketing Materials**
Flyers, posters, brochures, banners — grab attention!

**Presentations**
Slides that impress your audience.

## Getting Started

**Step 1: Pick What You're Making**
Click "New Design" and choose:
- Social media post
- Business card
- Flyer
- Custom size

**Step 2: Start with a Template (Recommended!)**
Browse our templates for inspiration. Click one to start with a professional design.

**Step 3: Make It Yours**
- Click text to edit words
- Click images to replace them
- Drag elements to move them around
- Use the color picker to change colors

**Step 4: Download or Share**
When you're done:
- Download as an image file (JPG, PNG)
- Share directly to social media
- Save to use later

## Design Tips for Beginners 💡

**Stick to 2-3 colors**: Too many colors look messy. Keep it simple.

**Use big, bold text for headlines**: People should be able to read it at a glance.

**Leave white space**: Don't fill every inch. Empty space makes things easier to read.

**Align everything**: Keep text and images lined up for a clean look.`,
      },
      {
        id: "canvas-editor",
        title: "Using the Canvas Editor",
        image: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&h=300&fit=crop",
        content: `# The Canvas Editor — Your Creative Playground 🖌️

The canvas is where the magic happens. It's like a digital piece of paper where you can add and arrange anything.

## What You'll See

**The Canvas (Center)**
This is your workspace — the white area where you create your design.

**The Toolbar (Top)**
Buttons for all the tools: add text, shapes, images, undo mistakes.

**The Side Panel (Right)**
Options for whatever you've selected. Click a shape? See options to change its color.

## Basic Actions

**Adding Text**
1. Click the "Text" button in the toolbar
2. Click where you want the text
3. Start typing!

**Adding Shapes**
1. Click the "Shapes" button
2. Pick a shape (rectangle, circle, star, etc.)
3. Click and drag on the canvas to draw it

**Adding Images**
1. Click "Image" in the toolbar
2. Upload your own or browse our library
3. Click to place it on the canvas

**Moving Things**
Click on anything to select it, then drag it wherever you want.

**Resizing**
Click to select, then drag the corner handles to make it bigger or smaller.

## Undo Mistakes

Made an error? No problem!
- Press **Ctrl + Z** (or Cmd + Z on Mac) to undo
- Press it multiple times to undo several steps

## Saving Your Work

Your work saves automatically! But you can also:
- Click "Save" anytime to be sure
- Click "Download" to get a copy on your computer

## Helpful Shortcuts

- **Ctrl + C** = Copy
- **Ctrl + V** = Paste
- **Ctrl + Z** = Undo
- **Delete key** = Remove selected item`,
      },
    ],
  },
  {
    id: "crm",
    title: "CRM & Pipeline",
    icon: Users,
    description: "Manage your contacts and sales",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop",
    articles: [
      {
        id: "crm-overview",
        title: "What is CRM?",
        image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&h=300&fit=crop",
        content: `# Your Customer Relationship Manager 👥

CRM stands for "Customer Relationship Management" — but think of it as your digital address book on steroids!

## What Does It Do?

**Keeps All Your Contacts in One Place**
No more scattered spreadsheets, sticky notes, or lost business cards. Everyone you do business with is right here.

**Tracks Your Conversations**
Remember when you last talked to someone and what you discussed. Never awkwardly ask "Did I already call you?"

**Helps You Follow Up**
Get reminders to reach out to people. Never let a potential customer slip through the cracks.

**Shows Your Sales Progress**
See how many deals you're working on and how close they are to closing.

## The Main Parts

**📇 Contacts**
All the people you know — customers, prospects, partners. Store their info and notes about them.

**🎯 Leads**
People who might become customers. Track them from "just interested" to "ready to buy."

**📊 Pipeline**
A visual board showing where each deal is in your sales process.

## Getting Started

1. **Add your first contact** — Click "Add Contact" and enter their name and email
2. **Add notes** — Write down what you know about them
3. **Set a follow-up** — Schedule when you'll reach out next

## Why Bother?

Without a CRM, it's easy to forget to follow up with people. With it:
- You close more deals
- Customers feel remembered and valued
- Your business grows!

## Don't Be Intimidated! 💡

Start simple. Just add a few contacts. The more you use it, the more valuable it becomes.`,
      },
      {
        id: "leads-management",
        title: "Turning Leads into Customers",
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=300&fit=crop",
        content: `# From "Maybe" to "Yes!" — Managing Your Leads 🎯

A lead is anyone who might buy from you. Maybe they filled out a form on your website, or you met them at a networking event. Here's how to turn them into happy customers!

## The Journey of a Lead

**1. They Show Interest**
Someone visits your website, downloads something, or reaches out. They're curious!

**2. You Reach Out**
Send them an email, give them a call, or connect on social media.

**3. You Learn About Them**
Find out what they need and if you can help them.

**4. You Make an Offer**
Share your pricing or proposal with them.

**5. They Say Yes! 🎉**
Congratulations — they're now a customer!

## How to Track Leads

**Add a New Lead**
1. Click "Add Lead" 
2. Enter their name and how they found you
3. Add any notes from your conversation

**Update Their Status**
As you talk to them, update where they are:
- **New** — Just added, haven't talked yet
- **Contacted** — You've reached out
- **Interested** — They're engaged
- **Proposal Sent** — Ball's in their court
- **Won** — They said yes! 🎉
- **Lost** — Not this time (that's okay!)

## Tips for Success 💡

**Follow up fast**: People are most interested right after they reach out. Don't wait!

**Take notes**: Write down what you discussed. You'll thank yourself later.

**Be helpful, not pushy**: People buy when they feel understood, not pressured.

**Don't give up too soon**: Sometimes people need 5+ touches before they're ready.

## Good News

Even if someone says "no," they might say "yes" later. Keep them in your system!`,
      },
      {
        id: "business-settings",
        title: "Setting Up Your Business",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=300&fit=crop",
        content: `# Get Your Business Settings Right ⚙️

Take a few minutes to set up your business profile. It helps everything work better and look more professional!

## Your Business Profile

**Add Your Company Info**
- Your business name — appears on documents and emails
- Your logo — looks great on everything you create!
- Contact details — phone, email, address

## Notifications — Stay in the Loop

Choose what you want to be notified about:

**Email Alerts**
- New lead comes in ✉️
- Task is due soon ⏰
- Deal status changes 📈

**You Decide the Frequency**
- Instant — get alerts right away
- Daily digest — one email per day
- Weekly summary — once a week overview

## Team Settings (If You Have a Team)

**Adding Team Members**
1. Click "Invite Team Member"
2. Enter their email
3. Choose what they can access

**Who Sees What**
You control who can:
- View contacts
- Edit projects
- Access billing

## Connecting Other Apps

Make Unison work with tools you already use:

- **Email**: Connect Gmail or Outlook to send emails directly
- **Calendar**: Sync with Google Calendar or Outlook
- **Payment**: Connect Stripe to accept payments

## Quick Setup Checklist ✅

- [ ] Added company name
- [ ] Uploaded logo
- [ ] Set up email notifications
- [ ] Invited team members (if applicable)
- [ ] Connected email account`,
      },
    ],
  },
  {
    id: "planning",
    title: "Task Planning",
    icon: Workflow,
    description: "Stay organized and on track",
    image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop",
    articles: [
      {
        id: "task-planning-guide",
        title: "Staying Organized",
        image: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=600&h=300&fit=crop",
        content: `# Never Forget a Task Again! ✅

The Task Planner helps you keep track of everything you need to do. No more mental juggling — just clear, organized lists.

## Three Ways to View Your Tasks

**📅 Calendar View**
See your tasks on a calendar. Great for planning your week ahead.

**📝 List View**
A simple list of everything. Easy to scan and check things off.

**📋 Board View (Kanban)**
Drag cards between columns like "To Do," "In Progress," and "Done." Very satisfying!

## Creating a Task

1. Click **"Add Task"**
2. Write what you need to do (keep it specific!)
3. Pick a due date (when does it need to be done?)
4. Set a priority:
   - 🔴 High — Do this first!
   - 🟡 Medium — Important but not urgent
   - 🟢 Low — Nice to do when you have time
5. Click **Save**

## Moving Tasks Along

When you start working on something:
- Change status to **"In Progress"**

When you finish:
- Mark it **"Complete"** — enjoy that checkmark! ✅

## Tips for Staying on Top of Things 💡

**Write everything down**: If it's in your head, it should be in your list.

**Be specific**: "Work on website" is vague. "Write homepage headline" is clear.

**Review daily**: Spend 5 minutes each morning looking at what's due.

**Celebrate wins**: Checking things off feels good. Enjoy it!

## What About Big Projects?

Break them into smaller pieces! Instead of:
- "Launch new product" ❌

Try:
- "Write product description" ✅
- "Take product photos" ✅
- "Set up product page" ✅
- "Test checkout process" ✅

Small steps = steady progress!`,
      },
    ],
  },
  {
    id: "cloud",
    title: "Cloud Dashboard",
    icon: Cloud,
    description: "Your account and settings",
    image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&h=200&fit=crop",
    articles: [
      {
        id: "cloud-dashboard-guide",
        title: "Your Cloud Dashboard",
        image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&h=300&fit=crop",
        content: `# Your Account Headquarters ☁️

The Cloud Dashboard is where you manage your account, settings, and connected services. Think of it as your control panel.

## What's Here?

**👤 Your Profile**
Update your name, photo, password, and notification preferences.

**🏢 Your Businesses**
If you work with multiple companies or brands, switch between them here.

**📁 Your Projects**
See all your websites and projects in one list.

**🖼️ Your Assets**
Quick access to your uploaded images and files.

**📧 Email Settings**
Set up your email to send messages directly from Unison.

**🔌 Connected Apps**
See what other services are connected to your account.

## Managing Your Profile

**To update your information:**
1. Click on your name/photo in the corner
2. Click "Profile"
3. Edit whatever you need
4. Click "Save"

**To change your password:**
1. Go to Profile
2. Click "Change Password"
3. Enter your current password
4. Enter your new password (twice)
5. Click "Update"

## Keeping Your Account Secure 🔒

We take security seriously! Here's how to stay safe:

**Use a strong password**: Mix letters, numbers, and symbols.

**Turn on two-factor authentication**: Get a code on your phone when you log in.

**Review your sessions**: See where you're logged in and log out remotely if needed.

## Need Help?

From the Cloud Dashboard, you can also:
- Access our help center
- Contact support
- Check your subscription status
- View your billing history`,
      },
    ],
  },
  {
    id: "files",
    title: "File Management",
    icon: FolderOpen,
    description: "Store and organize your files",
    image: "https://images.unsplash.com/photo-1544396821-4dd40b938ad3?w=400&h=200&fit=crop",
    articles: [
      {
        id: "files-guide",
        title: "Organizing Your Files",
        image: "https://images.unsplash.com/photo-1618044619888-009e412ff12a?w=600&h=300&fit=crop",
        content: `# Your Files, Safe and Organized 📁

Upload, store, and organize all your important files. Access them from anywhere!

## How to Upload Files

**The Easy Way: Drag and Drop**
1. Open the Files section
2. Drag files from your computer
3. Drop them in the window
4. Done!

**The Classic Way: Click to Browse**
1. Click the "Upload" button
2. Select files from your computer
3. Click "Open"

**Upload Many at Once**
Select multiple files (hold Ctrl/Cmd and click) and upload them all together!

## Keeping Things Organized

**Create Folders**
1. Click "New Folder"
2. Give it a name (like "Receipts 2024" or "Client Logos")
3. Click "Create"

**Move Files to Folders**
1. Click on a file to select it
2. Click "Move"
3. Choose the destination folder
4. Click "Move Here"

**Find Files Fast**
Use the search box! Type any part of a file name and watch results appear.

## Sharing Files

Need someone else to see a file?

1. Click on the file
2. Click "Share" 
3. Copy the link
4. Send it to them via email or message

They can view or download without needing an account!

## How Much Space Do You Have?

| Your Plan | Storage Space |
|-----------|---------------|
| Free | 100 MB |
| Pro | 10 GB |
| Business | 100 GB |

Running low? You can upgrade anytime or delete files you no longer need.

## File Tips 💡

**Use clear names**: "logo-final-v2.png" beats "IMG_39281.png"

**Create a folder system**: Organize by project, client, or date — whatever makes sense for you

**Clean up regularly**: Delete old files you don't need anymore`,
      },
    ],
  },
  {
    id: "launch-wizard",
    title: "Launch Wizard",
    icon: Rocket,
    description: "Answer a few questions, get a complete site",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=200&fit=crop",
    articles: [
      {
        id: "wizard-walkthrough",
        title: "Launching Your First Site",
        image: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=600&h=300&fit=crop",
        content: `# Launching Your First Site 🚀

The Launch Wizard turns a handful of answers into a finished, multi-page website — not a blank template you have to fill in yourself.

## The Four Questions

**1. What is your business?**
Your name and what you do. This is used for real copy on the page, not placeholder text.

**2. What kind of business is it?**
Salon, restaurant, shop, contractor, agency, coaching, real estate, software, nonprofit, portfolio. Each one starts from a different set of pages.

**3. What do you want people to do?**
Book an appointment, buy something, request a quote, join a list. Your answer decides which buttons appear and what they actually do.

**4. How should it look?**
Pick a style card. Every card is a real, finished design direction — colours, type, spacing and motion all move together.

## What You Get

A salon gets Services, Gallery, Our Studio, Book and FAQ. A restaurant gets Menu, Gallery and Reservations. A shop gets Shop, Journal, Help and a checkout. Every page is written for your business, wired to real buttons, and styled to match the home page.

## Regenerating

Not in love with the result? Press **Regenerate**. Your answers stay the same and the look shifts to another finished option. Answers never change by accident.

## Quick Tip 💡

Spend the extra minute on question 3. It is the single answer that decides whether your site takes bookings, payments or enquiries.`,
      },
      {
        id: "same-answers-same-site",
        title: "Why the Same Answers Build the Same Site",
        image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=300&fit=crop",
        content: `# Same Answers, Same Site 🎯

Most AI website tools roll the dice every time you press the button. Unison does not.

## Predictable by Design

Your answers are compiled into a site the same way every time. Launch twice with the same answers and you get the same pages, the same layout, the same colours. Nothing drifts between attempts.

## Only You Move the Design

Two things change the look, and both are yours:
- **Changing an answer** — a different industry, goal or style card
- **Pressing Regenerate** — a deliberate request for a different finished option

Nothing else. Time of day, luck and retries have no effect.

## Every Site Has a Fingerprint

Each generated site carries a short fingerprint. If two sites share the same fingerprint, they are the same site. It is how support can tell instantly whether something really changed.

## Why It Matters

- You can show a client a result and reproduce it exactly next week
- A bug can be reproduced instead of guessed at
- "Regenerate" is a choice, not a gamble`,
      },
      {
        id: "styles-and-look",
        title: "Style Cards and Your Site's Look",
        image: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=600&h=300&fit=crop",
        content: `# Style Cards 🎨

A style card is a complete design direction, not just a colour swap.

## Six Design Families

Every card belongs to one of six families — **Modern, Bold, Editorial, Minimalist, Futuristic and Organic**. A family is a visual philosophy; each one holds several finished directions (for example Editorial includes Noir Atelier, a dark studio look made for salons and spas).

Unison only offers a direction if it can build every part of your site — menu bar, banner, services, gallery, reviews, prices, contact and footer. Once chosen, your site stays in that family: reopening, editing with the AI Builder and publishing all keep the same family, and switching cards moves you cleanly to a new one.

## What a Card Controls

- **Type** — which typefaces, how big, how tightly spaced
- **Colour** — a full palette, including dark and light surfaces
- **Spacing** — airy and editorial, or tight and commercial
- **Motion** — how sections reveal as you scroll
- **Media** — full-bleed photography, mosaics, or contained cards

## Every Page Inherits the Home Page

Whatever the home page establishes, the rest of the site follows. No page invents its own colours or its own heading size. If you change the look, it changes everywhere at once.

## Page-by-Page Rhythm

Pages still breathe differently where it matters. A checkout stays lean and focused. A gallery is given room to show work. The look never changes — only the pacing.

## Choosing Well

- **Booking and beauty businesses** — the darker, editorial cards photograph beautifully
- **Shops** — commercial cards put products and prices first
- **Studios and portfolios** — cinematic cards give images the most room

## Quick Tip 💡

Pick the card whose photography looks most like yours. Style and imagery carry each other.`,
      },
    ],
  },
  {
    id: "ai-builder",
    title: "AI Builder",
    icon: Sparkles,
    description: "Edit your site by describing the change",
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=200&fit=crop",
    articles: [
      {
        id: "editing-with-ai",
        title: "Editing by Describing",
        image: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=600&h=300&fit=crop",
        content: `# Editing by Describing ✍️

Open any project in the Builder and tell the assistant what you want. Plain sentences work best.

## Good Requests

- "Make the booking button bigger and move it above the photo"
- "Swap the gallery on every page for the mosaic layout"
- "Change the headline on the Services page to 'Colour, cut and care'"
- "Add a frequently asked questions section to the Book page"

## What Happens Next

1. The assistant works out exactly which part of the site you mean
2. It prepares the change
3. The change is checked before anything is saved
4. It is saved, and the preview is watched to confirm it really rendered
5. Only then do you see **Changes applied**

## Nothing Is Half-Applied

If any step fails, the whole change is rolled back and you are told why in plain words. Your site is never left in a partly edited state.

## If You See "Held for Review"

That means the change saved but the preview did not confirm it. Reload the preview. If it still does not show, undo and describe the change differently — something in the request could not be rendered safely.

## Quick Tip 💡

One change per request lands faster and is far easier to undo.`,
      },
      {
        id: "verified-changes",
        title: "Why Unison Never Says 'Done' Too Early",
        image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=300&fit=crop",
        content: `# Verified, Not Claimed ✅

Most AI tools tell you an edit worked because the AI said so. Unison refuses to.

## The Checks Behind "Applied"

Before you ever see a success message:
- The change must be valid on its own
- Everything it references must exist
- It must save to your project as one complete step
- The preview must load it without breaking

Fail any one and you get a clear reason instead of a green tick.

## The Three Outcomes

**Applied** — saved and confirmed in the preview.

**Held for review** — saved, but the preview did not confirm it. Worth a reload or an undo.

**Failed** — nothing changed. Your files are exactly as they were.

## Undo Is Always There

Every edit can be undone, including AI edits. Your previous version is kept.`,
      },
      {
        id: "design-panel",
        title: "The Design Panel",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=300&fit=crop",
        content: `# The Design Panel 🎛️

Not every change needs a sentence. Click any part of your site and edit it directly.

## What You Can Change

- **Text** — click it and type
- **Images** — swap in one of your own uploads
- **Section layout** — pick a different finished layout for that block
- **Spacing and alignment** — nudge without touching code
- **Order** — move a section up or down, or remove it

## Change It Everywhere

Changing a section's layout can be applied across the whole site at once, so every page keeps the same look. You can exclude specific pages if one needs to stay as it is.

## Colours Stay On-Palette

The panel only offers colours from your site's palette. Off-palette colours are blocked on purpose — it is what keeps the site looking like one site.

## Quick Tip 💡

Use the panel for small, precise edits and the assistant for bigger structural ones.`,
      },
    ],
  },
  {
    id: "publishing",
    title: "Publishing & Domains",
    icon: Globe,
    description: "Take your site live",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=200&fit=crop",
    articles: [
      {
        id: "publish-guide",
        title: "Publishing Your Site",
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=300&fit=crop",
        content: `# Publishing Your Site 🌍

When the preview looks right, publishing takes a moment.

## How to Publish

1. Open your project
2. Check the preview one last time
3. Click **Publish**
4. Your site goes live on its own web address

## What Gets Published

Exactly the version you just approved — the same pages, the same content, the same design. Never a half-saved draft.

## Checks Before You Go Live

Publishing is blocked if the site is not whole:
- A button links to a page that does not exist
- A page is missing from the menu or has no route
- A page has two headers or two footers
- A required feature, like a booking form, is still a placeholder

You are told which one, and where. Fix it and publish again.

## Updating a Live Site

Edit, preview, publish again. Visitors see the new version within moments, and your address stays the same.`,
      },
      {
        id: "custom-domain",
        title: "Using Your Own Web Address",
        image: "https://images.unsplash.com/photo-1484417894907-623942c8ee29?w=600&h=300&fit=crop",
        content: `# Your Own Web Address 🔗

Swap the default address for something like **yourbusiness.com**.

## If You Already Own a Domain

1. Open **Settings → Domains**
2. Enter your domain
3. Copy the two records shown
4. Paste them into your domain provider's DNS settings
5. Come back and click **Verify**

Verification is usually minutes, occasionally a few hours.

## If You Do Not Own One Yet

Search for one from the same screen and buy it — it connects itself, with no DNS work for you.

## Good to Know

- Secure browsing (the padlock) is set up for you
- Both **yourbusiness.com** and **www.yourbusiness.com** work
- Custom addresses are on paid plans

## If Verification Stalls

DNS changes can be slow. Wait an hour and click Verify again before changing anything — most "failures" are simply not finished yet.`,
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Help & Troubleshooting",
    icon: LifeBuoy,
    description: "Fixes for the things that come up most",
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&h=200&fit=crop",
    articles: [
      {
        id: "common-issues",
        title: "Common Problems and Fixes",
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=300&fit=crop",
        content: `# Common Problems 🔧

## The Preview Is Blank

Usually a page still loading something heavy. Reload the preview first. If it stays blank, undo your last change — the assistant will tell you what it could not render.

## My Edit Did Not Show Up

Check what the assistant reported. **Held for review** means it saved but the preview did not confirm it — reload. **Failed** means nothing changed at all, so try describing the change differently.

## A Button Does Nothing

Buttons are wired to real actions such as booking, checkout or contact. If one does nothing, its feature is probably not switched on yet. Open the project's features and enable it, then republish.

## Publishing Is Blocked

The site is not whole yet — a broken link, a missing page, a duplicated header, or a feature that is still a placeholder. The message names the exact page.

## My Site Looks Different on Phones

Layouts adapt automatically. If something looks wrong, resize the preview to phone width, click the offending section and adjust it there.

## Images Look Stretched

Replace the image with one closer to the shape the layout expects, or choose a layout that suits your photo. Unison will never substitute a stock photo for one of yours.

## Still Stuck?

Send us your project name and, if you have it, the site fingerprint shown in project details. It tells us exactly which version you are looking at.`,
      },
      {
        id: "faq",
        title: "Frequently Asked Questions",
        image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=300&fit=crop",
        content: `# Frequently Asked Questions ❓

**Do I need to know how to code?**
No. Everything here works by clicking and describing. The code exists, and you can read it if you want to.

**Can I export my site?**
Yes, on paid plans. You get the complete source, not a locked export.

**Will two businesses in the same industry get the same site?**
No. Two salons get two different salon sites. Same rules, different results.

**Can I undo an AI edit?**
Always. Every edit is reversible, and failed edits never touch your files.

**Where are the designs from?**
Unison's own curated, production-certified design registry. Every block is a real, crafted design — never an improvised AI mock-up.

**Who can see my data?**
Only you and people you invite. Each business's data is isolated at the database level.

**Can I use my own photos?**
Yes, and you should. Uploaded photos always replace sample imagery, and your logo is never swapped out.

**What happens if I hit my plan limit?**
Existing work keeps running. You are prompted to upgrade before anything new is created.`,
      },
    ],
  },
];

export const quickLinks = [
  { title: "Welcome Guide", sectionId: "getting-started", articleId: "platform-overview" },
  { title: "What Unison Is For", sectionId: "getting-started", articleId: "who-uses-unison" },
  { title: "Launch a Site", sectionId: "launch-wizard", articleId: "wizard-walkthrough" },
  { title: "Edit with AI", sectionId: "ai-builder", articleId: "editing-with-ai" },
  { title: "Publish & Domains", sectionId: "publishing", articleId: "publish-guide" },
  { title: "Style Cards", sectionId: "launch-wizard", articleId: "styles-and-look" },
  { title: "Build a Website", sectionId: "web-builder", articleId: "web-builder-intro" },
  { title: "Customer Manager", sectionId: "crm", articleId: "crm-overview" },
  { title: "Design Graphics", sectionId: "design-studio", articleId: "design-studio-overview" },
  { title: "Your Files", sectionId: "files", articleId: "files-guide" },
  { title: "Troubleshooting", sectionId: "troubleshooting", articleId: "common-issues" },
];
