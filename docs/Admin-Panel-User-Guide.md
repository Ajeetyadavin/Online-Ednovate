# Online Ednovate Admin Panel Guide

Version: 1.1
Audience: Admin, Subadmin, Content Team, Support Team

## 1. Quick Start

1. Log in to the admin panel.
2. Open the required module from the sidebar.
3. After every major change, click Save or Update.
4. After course or lecture updates, perform a quick student-side check.

## 2. Sidebar Modules and Their Purpose

### Dashboard
- Provides a platform-level summary.
- Shows key stats: courses, users, sales, and recent activity.
- Best starting point for daily monitoring.

### Home Page
- Manages homepage sections and content.
- Controls banners, section placement, and visibility.

### Admins
- Create, edit, and remove subadmin accounts.
- Manage role and permission-based access.
- Assign module-level permissions by team role.

### Masters
- Maintains reusable master data and dropdown values.
- Examples: pricing dimensions, validity options, attempts, delivery modes.

### Videos
- Main curriculum builder for courses.
- Add, edit, reorder chapters and lessons.
- Set lecture source (direct upload, YouTube, Bunny, resource links).

### Courses
- Create and edit courses.
- Configure pricing, tax, combinations, demo video, metadata, and visibility.

### Users
- Manage student/user records.
- Review user details, access data, and support-related information.

### Settings
- Configure platform settings, SMTP, payment gateways, and security toggles.
- Includes the Sidebar Manager.

## 3. Additional Modules

### Bunny Video Storage
- Upload and organize videos in Bunny library.
- Create collections, move/delete videos, and search library content.

### Coupons
- Create and manage discount coupons and rule configuration.

### Sales
- Track orders and payment status.

### Call Requests
- Track leads/callback requests and assign follow-ups.

### Technical Support
- Manage user issues and support workflow.

### Marketing
- Manage campaigns, announcements, and engagement settings.

### Reports
- View system/activity logs and usage insights.

### API
- Reference integration endpoints and API modules.

## 4. Standard Course Creation Flow

1. Open the Courses module.
2. Click Add Course (or edit an existing course).
3. Fill basic details:
   - Title
   - Category/Level
   - Subject/Faculty
   - Thumbnail
4. In the Pricing tab, configure price, tax, and combination settings.
5. In the Content tab, set demo video and key details.
6. Save the course.
7. Verify the final result from the student-side view.

## 5. Lecture Upload Guide (Step-by-Step)

There are three practical methods for uploading/adding lectures.

## Method A: Direct Upload from Videos Module

1. Open Videos from the sidebar.
2. Select the target course.
3. Select a chapter, or create a new chapter.
4. Click Add Lesson.
5. Set lesson type to Video.
6. Choose source as Direct/Upload.
7. Select the video file.
8. Wait for upload progress to complete.
9. Fill title, duration, description, and preview toggle.
10. Save the lesson.
11. Save curriculum if a separate save action is shown.

## Method B: Add Lecture via YouTube URL

1. In Videos module, open Add Lesson.
2. Set lesson type to Video.
3. Choose source as YouTube.
4. Paste a valid YouTube URL.
5. Fill title, duration, and description.
6. Save the lesson.
7. Test playback from student side.

## Method C: Bunny Video Storage + Import to Course

Part 1: Upload to Bunny storage
1. Open Bunny Video Storage module.
2. Optionally create a collection (recommended chapter-wise).
3. Choose video file in upload section.
4. Select collection (optional but recommended).
5. Upload and confirm success message.

Part 2: Import into course curriculum
1. Open Videos module and select target course/chapter.
2. Open Bunny collection/import dialog.
3. Select required videos.
4. Import/Add to chapter.
5. Verify lesson metadata and save.

## 6. Lecture Upload Best Practices

- Use clear file naming, for example: subject_chapter_topic_language.mp4
- Group chapter videos in Bunny collections.
- Before publishing, verify:
  - Playback test
  - Duration accuracy
  - Preview flag status
  - Correct chapter mapping
- Do not close browser tab during large uploads.
- If upload fails, verify network and retry.

## 7. Quality Checklist (Before Going Live)

Course-level checklist:
- Title and thumbnail are correct
- Pricing and tax are correct
- Demo video is working
- Course visibility is in intended state

Lecture-level checklist:
- Lesson order is correct
- Video playback works
- PDF/resource links work
- Preview lectures are correctly marked

Admin-level checklist:
- Correct modules are enabled in sidebar
- Subadmin permissions are restricted correctly
- SMTP and payment settings are validated

## 8. Common Issues and Fixes

### Issue: Lecture does not play
- Check video URL/source mapping.
- Verify Bunny/YouTube IDs.
- Verify student access and package mapping.

### Issue: Upload failed
- Validate file size and format.
- Check network stability.
- Retry upload and wait for completion.

### Issue: Sidebar module order mismatch
- Go to Settings > Sidebar.
- Click Reset Default.
- Save settings.
- Hard refresh the browser.

## 9. Recommended Team Workflow

- Content Team:
  - Organize Bunny storage.
  - Maintain chapter-wise upload plan.
- Academic Reviewer:
  - Validate sequence, titles, and correctness.
- Admin:
  - Finalize pricing and publishing controls.
- QA:
  - Test complete student-side flow.

## 10. Final Note

This guide is a practical SOP for daily admin operations. You can also maintain role-specific guides as separate PDFs:
- Content Team Guide
- Sales/Support Guide
- Superadmin Configuration Guide
