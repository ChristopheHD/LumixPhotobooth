var gulp = require('gulp'),
  sass = require('gulp-sass')(require('sass')),
  sassGlob = require('gulp-sass-glob'),
  postcss = require('gulp-postcss'),
  autoprefixer = require('autoprefixer'),
  sortMediaQueries = require('postcss-sort-media-queries'),
  plumber = require('gulp-plumber'),
  sourcemaps = require('gulp-sourcemaps'),
  log = require('fancy-log'),
  colors = require('ansi-colors'),
  through = require('through2');


/* ***** Gulp Tasks ***** */

/***
---------------------------------------------------------
// Compile CSS, apply prefixer and sourcemaps
---------------------------------------------------------  */
function scss() {
  log(colors.bgGreen('   ..::: SCSS TASKS :::...   '));

  var processors = [
    autoprefixer(),
    sortMediaQueries()
  ];

  return gulp.src('./app/sass/*.scss')
  .pipe(plumber())
  .pipe(sassGlob())
  .pipe(sourcemaps.init())
  .pipe(sass().on('error', sass.logError))
  .pipe(postcss(processors))
  .pipe(through.obj(function(file, enc, cb) {
    if (file.isBuffer()) {
      var content = file.contents.toString();
      content = content.replace(/<\/(style)/gi, '<\\/$1');
      file.contents = Buffer.from(content);
    }
    cb(null, file);
  }))
  .pipe(sourcemaps.write())
  .pipe(gulp.dest('./app/css'));
}

exports.scss = scss;

function watchTask() {
  gulp.watch('./app/sass/**', scss);
}

exports.watch = gulp.series(scss, watchTask);
exports.default = scss;
