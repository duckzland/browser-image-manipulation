import {loadBlob} from './loaders/loadBlob.js'
import {loadCanvas} from './loaders/loadCanvas.js'
import {imageCrop, imageResize} from './manipulations/imageResize.js'
import {rotate} from './manipulations/rotate.js'
import {centerInRectangle} from './manipulations/centerInRectangle.js'
import {circle} from './manipulations/circle.js'
import {grayscale} from './filters/grayscale.js'
import {pixelize} from './filters/pixelize.js'
import {gaussianBlur} from './filters/gaussianBlur.js'
import {asBlob} from './savers/asBlob'
import {asCanvas} from './savers/asCanvas'
import {asImage} from './savers/asImage'
import {drawLine, drawPolygon, drawRectangle, drawText} from './draw/draw'
import {perspective} from './manipulations/perspective'

import {RESIZE_TYPE_SQUARE, RESIZE_TYPE_TO, MANIPULATION, LOADER, FILTER, DRAW} from './constants'

export class ImageManipulation {
    constructor () {
        this._tasks = []

        this._canvas = null
        this._loadedCanvas = null
        this._lastCanvas = null

        this._fileName = null
        this._exif = {}
    }

    /**
     * @param imageFile{File}
     * @param options{Object}
     * @param options.fixOrientation{Boolean}
     * @param options.readExif{Boolean}
     * @returns {ImageManipulation}
     */
    loadBlob (imageFile, options) {
        this._addToTask(LOADER, loadBlob(imageFile, options))
        return this
    }

    /**
     * @param canvas{HTMLCanvasElement}
     * @param fileName{String}
     * @returns {ImageManipulation}
     */
    loadCanvas (canvas, fileName = 'canvas.png') {
        this._addToTask(LOADER, loadCanvas(canvas, fileName))
        return this
    }

    /**
     * @param maxWidth
     * @param maxHeight
     * @param type
     * @param options
     * @returns {ImageManipulation}
     * @private
     */
    _imageResize (maxWidth = 200, maxHeight = 100, type = null, options = {}) {
        this._addToTask(MANIPULATION, imageResize(maxWidth, maxHeight, type, options))
        return this
    }

    /**
     * @param length
     * @param opts{Object}
     * @returns {ImageManipulation}
     */
    toSquare (length = 150, opts = {}) {
        return this._imageResize(length, length, RESIZE_TYPE_SQUARE, opts)
    }

    /**
     * @param maxWidth {number} - width to crop to.
     * @param maxHeight {number} - height to crop to.
     * @param offsetX{number} - If specified, cropping will start from that offset on X axis,
     * otherwise it will crop so result is centered in the source
     * @param offsetY{number} - If specified, cropping will start from that offset on Y axis,
     * otherwise it will crop so result is centered in the source
     * @returns {ImageManipulation}
     */
    crop (maxWidth, maxHeight, offsetX, offsetY) {
        this._addToTask(MANIPULATION, imageCrop(maxWidth, maxHeight, offsetX, offsetY))
        return this
    }

    /**
     *
     * @param maxWidth
     * @param maxHeight
     * @param opts{Object}
     * @returns {ImageManipulation}
     */
    resize (maxWidth = 200, maxHeight = 100, opts = {}) {
        return this._imageResize(maxWidth, maxHeight, RESIZE_TYPE_TO, opts)
    }

    /**
     *
     * @param degrees
     * @param opts{Object}
     * @returns {ImageManipulation}
     */
    rotate (degrees, opts = {}) {
        this._addToTask(MANIPULATION, rotate(degrees, opts))
        return this
    }

    /**
     *
     * @param opts{Object}
     * @returns {ImageManipulation}
     */
    toGrayscale (opts = {}) {
        this._addToTask(FILTER, grayscale(opts))
        return this
    }

    /**
     *
     * @param threshold{Number}
     * @returns {ImageManipulation}
     */
    pixelize (threshold = 0.2) {
        this._addToTask(FILTER, pixelize(threshold))
        return this
    }

    /**
     *
     * @param radius{Number}
     * @returns {ImageManipulation}
     */
    gaussianBlur (radius = 10) {
        this._addToTask(FILTER, gaussianBlur(radius))
        return this
    }

    /**
     *
     * @param width
     * @param height
     * @param opts{Object}
     * @returns {ImageManipulation}
     */
    centerInRectangle (width = 200, height = 100, opts = {}) {
        // resize
        this._imageResize(width, height, RESIZE_TYPE_TO, opts)
        // fit
        this._addToTask(MANIPULATION, centerInRectangle(width, height, opts))
        return this
    }

    /**
     * @param diametr
     * @param opts{Object}
     * @returns {ImageManipulation}
     */
    toCircle (diametr = 150, opts = {}) {
        // resize to square first
        this._imageResize(diametr, diametr, RESIZE_TYPE_SQUARE, opts)
        this._addToTask(MANIPULATION, circle(diametr, opts))
        return this
    }

    /**
     * @returns {Promise}
     */
    async _runTasks () {
        this._canvas = null
        for (let i = 0; i < this._tasks.length; i++) {
            // if type loader, covert image to canvas and save in _loadedCanvas
            if (this._tasks[i].type === LOADER) {
                let data = await this._tasks[i].func()
                this._loadedCanvas = data.canvas
                if (data.fileName) {
                    this._fileName = data.fileName;
                }
                if (data.exif) {
                    this._exif = data.exif
                }
            } else {
                if (this._canvas === null && this._loadedCanvas === null) {
                    throw new Error('use loadBlob first')
                }
                this._canvas = await this._tasks[i].func(this._canvas || this._loadedCanvas)
            }
        }
        this._cleanTasks()
    }

    /**
     * @param type{String}
     * @param func{Function}
     * @private
     */
    _addToTask (type = 'manipulation', func) {
        this._tasks.push({type, func})
    }

    _cleanTasks () {
        this._tasks = []
        // save last canvas
        // for save image after all convert in same formats
        if (this._canvas !== null) {
            this._lastCanvas = this._canvas
        }
    }

    /**
     * @returns {HTMLCanvasElement}
     */
    getCanvas () {
        return this._canvas || this._lastCanvas
    }

    /**
     *
     * @returns {String}
     */
    getFileName () {
        return this._fileName
    }

    /**
     * @returns {Object}
     */
    getExif () {
        return this._exif
    }

    /**
     *
     * @param newFileName - New filename to be used in mime type definition
     */
    setFileName (newFileName) {
        this._fileName = newFileName;
    }

    /**
     * @param mimeType
     * @param q
     * @returns {Promise<File>}
     */
    saveAsBlob (mimeType = 'image/jpeg', q = '1.0') {
        return this._runTasks().then(() => asBlob(this.getCanvas(), this.getFileName(), mimeType, q))
    }

    /**
     * @returns {Promise<HTMLCanvasElement>}
     */
    saveAsCanvas () {
        return this._runTasks().then(() => asCanvas(this.getCanvas()))
    }

    /**
     * @param mimeType
     * @param q
     * @returns {Promise<HTMLImageElement.src>}
     */
    saveAsImage (mimeType = 'image/jpeg', q = '1.0') {
        return this._runTasks().then(() => asImage(this.getCanvas(), mimeType, q))
    }

    /**
     * @param points Sequence of [[x0, y0], [x1, y1] ...] or [x0, y0, x1, y1 ...]
     * @param fill Color to use for the line
     * @param width The line width, in pixels
     * @returns {ImageManipulation}
     */
    drawLine (points = [], fill = 'green', width = 6) {
        this._addToTask(DRAW, drawLine(points, fill, width))
        return this
    }

    /**
     * @param points Sequence of [[x0, y0], [x1, y1] ...] or [x0, y0, x1, y1 ...]
     * @param fill Color to use for fill poly
     * @param outline Color to use for the outline
     * @param outlineWidth The outline width, in pixels
     * @returns {ImageManipulation}
     */
    drawPolygon (points = [], fill = 'green', outline = 'red', outlineWidth = 6) {
        this._addToTask(DRAW, drawPolygon(points, fill, outline, outlineWidth))
        return this
    }

    /**
     * @param points Sequence of [[left, bottom], [right, top]] or [left, bottom, right, top]
     * @param fill null or color use for fill poly
     * @param outline null or color to use for the outline
     * @param outlineWidth The outline width, in pixels
     * @returns {ImageManipulation}
     */
    drawRectangle (points = [], fill = null, outline = 'red', outlineWidth = 6) {
        this._addToTask(DRAW, drawRectangle(points, fill, outline, outlineWidth))
        return this
    }

    /**
     * @param xy{Array}
     * @param text{String}
     * @param style{Object}
     * @param style.font for example 'serif bold 16px'
     * @param style.fontSize null or size in % or px
     * @param style.fill null or color use for fill
     * @param style.fillPadding null or color use for fill
     * @param style.angle null or degrees for rotate text
     * @returns {ImageManipulation}
     */
    drawText (xy = [], text = '', style = {}) {
        this._addToTask(DRAW, drawText(xy, text, style))
        return this
    }

    /**
     * @param points - {xy0: [], xy1: [], xy2: [], xy3: []}
     * @returns {ImageManipulation}
     */
    perspective (points) {
        this._addToTask(MANIPULATION, perspective(points))
        return this
    }
}
