var gulp = require('gulp'),
  autoprefixer = require('gulp-autoprefixer'),
  plumber = require('gulp-plumber'),
  sourcemaps = require('gulp-sourcemaps'),
  sass = require('gulp-sass')(require('sass')),
  globCss = require('gulp-css-globbing'),
  gcmq = require('gulp-group-css-media-queries'),
  log = require('fancy-log'),
  colors = require('ansi-colors');


/* ***** Gulp Tasks ***** */

/***
---------------------------------------------------------
// Compile CSS, apply prefixer and sourcemaps if set to dev
---------------------------------------------------------  */
function scss() {
  log(colors.bgGreen('   ..::: SCSS TASKS :::...   '));

  return gulp.src('./app/sass/*.scss')
  .pipe(globCss({
    extensions: ['.css', '.scss'],
    autoReplaceBlock: {
      onOff: false,
      globBlockBegin: 'cssGlobbingBegin',
      globBlockEnd: 'cssGlobbingEnd',
      globBlockContents: '../**/*.scss'
    }
  }))
  .pipe(plumber())

  .pipe(sourcemaps.init())

  .pipe(sass().on('error', sass.logError))
  .pipe(autoprefixer())
  .pipe(gcmq())
  .pipe(sourcemaps.write())
  .pipe(gulp.dest('./app/css'));
}

exports.scss = scss;

function watchTask() {
  gulp.watch('./app/sass/**', scss);
}

exports.watch = gulp.series(scss, watchTask);
exports.default = scss;
