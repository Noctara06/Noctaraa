const express = require("express");
const controller = require("./reader.controller");
const {
  requireAuth,
  authorizePermissions
} = require("../../common/middlewares/auth.middleware");
const { PERMISSIONS } = require("../../common/auth/rbac");

const router = express.Router();

router.get("/state", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.getReaderState);
router.post("/chapters/:chapterId/likes", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.likeChapter);
router.delete("/chapters/:chapterId/likes", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.unlikeChapter);
router.post("/likes/:storyId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.likeStory);
router.delete("/likes/:storyId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.unlikeStory);
router.post("/library/:storyId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.saveStory);
router.delete("/library/:storyId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.unsaveStory);
router.post("/collections", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.createCollection);
router.get("/collections/public/:userId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.listPublicCollectionsByUser);
router.patch("/collections/:collectionId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.updateCollection);
router.delete("/collections/:collectionId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.deleteCollection);
router.post("/collections/:collectionId/stories/:storyId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.addStoryToCollection);
router.delete("/collections/:collectionId/stories/:storyId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.removeStoryFromCollection);
router.post("/subscriptions/:storyId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.subscribeStoryUpdates);
router.delete("/subscriptions/:storyId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.unsubscribeStoryUpdates);
router.post("/author-subscriptions/:authorId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.subscribeAuthorUpdates);
router.delete("/author-subscriptions/:authorId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.unsubscribeAuthorUpdates);
router.put("/progress/:storyId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.updateReadingProgress);
router.get("/authors/:authorId/followers", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.listAuthorFollowers);
router.post("/follows/:authorId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.followAuthor);
router.delete("/follows/:authorId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.unfollowAuthor);
router.get("/chapters/:chapterId/comments", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.listChapterComments);
router.post("/chapters/:chapterId/comments", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.createChapterComment);
router.get("/comments/:storyId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.listStoryComments);
router.post("/comments/:storyId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.createStoryComment);
router.get("/authors/:authorId/questions", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.listAuthorProfileComments);
router.post("/authors/:authorId/questions", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.createAuthorProfileComment);
router.patch("/author-questions/:commentId/reply", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.replyAuthorProfileComment);
router.delete("/author-questions/:commentId", requireAuth, authorizePermissions(PERMISSIONS.STORIES_READ), controller.deleteAuthorProfileComment);

module.exports = router;
