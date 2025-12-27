/**
 * ADDRESS ROUTES
 * ==============
 *
 * API routes for Vietnamese address parsing and suggestions
 */

const express = require('express');
const router = express.Router();
const addressParsingController = require('../controllers/addressParsingController');

/**
 * @swagger
 * /api/parse-address:
 *   post:
 *     summary: Parse Vietnamese address using Groq AI
 *     description: Parse raw Vietnamese address text into structured components using AI
 *     tags: [Address Parsing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Raw address text to parse
 *                 example: "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM"
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Address parsed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Address parsed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     originalText:
 *                       type: string
 *                       example: "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM"
 *                     parsedAddress:
 *                       type: object
 *                       properties:
 *                         houseNumber:
 *                           type: string
 *                           nullable: true
 *                           example: "123"
 *                         street:
 *                           type: string
 *                           nullable: true
 *                           example: "Đường Nguyễn Huệ"
 *                         ward:
 *                           type: string
 *                           nullable: true
 *                           example: "Phường Bến Nghé"
 *                         district:
 *                           type: string
 *                           nullable: true
 *                           example: "Quận 1"
 *                         city:
 *                           type: string
 *                           nullable: true
 *                           example: "Thành phố Hồ Chí Minh"
 *                         province:
 *                           type: string
 *                           nullable: true
 *                           example: "Thành phố Hồ Chí Minh"
 *                         postalCode:
 *                           type: string
 *                           nullable: true
 *                           example: "70000"
 *                         landmarks:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["Bitexco Tower"]
 *                         fullAddress:
 *                           type: string
 *                           example: "123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh"
 *                         confidence:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 1
 *                           example: 0.95
 *                         alternatives:
 *                           type: array
 *                           items:
 *                             type: object
 *                           description: Alternative parsing options
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - invalid input
 *       500:
 *         description: Server error
 */
router.post(
  '/parse-address',
  addressParsingController.parseAddress
);

/**
 * @swagger
 * /api/parse-address/suggestions:
 *   post:
 *     summary: Get address suggestions based on partial input
 *     description: Provide autocomplete suggestions for Vietnamese addresses based on partial text input. Supports location-based suggestions prioritizing nearby addresses when userLocation is provided.
 *     tags: [Address Parsing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Partial address text for suggestions
 *                 example: "Nguyen Hue"
 *                 maxLength: 200
 *               maxSuggestions:
 *                 type: integer
 *                 description: Maximum number of suggestions to return
 *                 default: 5
 *                 minimum: 1
 *                 maximum: 10
 *                 example: 5
 *               userLocation:
 *                 type: object
 *                 description: User's current location for location-based suggestions
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     description: Latitude coordinate
 *                     minimum: -90
 *                     maximum: 90
 *                     example: 10.7769
 *                   longitude:
 *                     type: number
 *                     description: Longitude coordinate
 *                     minimum: -180
 *                     maximum: 180
 *                     example: 106.7009
 *     responses:
 *       200:
 *         description: Address suggestions generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Found 3 address suggestions"
 *                 data:
 *                   type: object
 *                   properties:
 *                     query:
 *                       type: string
 *                       example: "Nguyen Hue"
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           text:
 *                             type: string
 *                             example: "Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh"
 *                           parsed:
 *                             type: object
 *                             properties:
 *                               street:
 *                                 type: string
 *                                 example: "Đường Nguyễn Huệ"
 *                               ward:
 *                                 type: string
 *                                 example: "Phường Bến Nghé"
 *                               district:
 *                                 type: string
 *                                 example: "Quận 1"
 *                               city:
 *                                 type: string
 *                                 example: "Thành phố Hồ Chí Minh"
 *                           relevance:
 *                             type: number
 *                             minimum: 0
 *                             maximum: 1
 *                             example: 0.95
 *                           distance:
 *                             type: number
 *                             nullable: true
 *                             description: Distance in kilometers from user's location
 *                             example: 2.5
 *                           coordinates:
 *                             type: object
 *                             nullable: true
 *                             description: Estimated coordinates of the address
 *                             properties:
 *                               latitude:
 *                                 type: number
 *                                 example: 10.7769
 *                               longitude:
 *                                 type: number
 *                                 example: 106.7009
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - invalid input
 *       500:
 *         description: Server error
 */
router.post(
  '/parse-address/suggestions',
  addressParsingController.getAddressSuggestions
);

module.exports = router;
