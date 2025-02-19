import gulp from "gulp";
import path from 'path';
import util from "gulp-util";
import gulpSass from "gulp-sass";
import concat from "gulp-concat";
import imagemin from "gulp-imagemin";
import sourcemaps from "gulp-sourcemaps";
import autoprefixer from "gulp-autoprefixer";
import sassCompiler from "sass";
import panini from "panini";
import del from "del";
import browserify from "browserify";
import babelify from "babelify";
import source from "vinyl-source-stream";
import logSymbols from "log-symbols";
import BrowserSync from "browser-sync";
import options from "./config.js";


import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const { src, dest, watch, series, parallel } = gulp;
const browserSync = BrowserSync.create();
var reload = browserSync.reload;
const nodepath = __dirname+"/node_modules/";
const sass = gulpSass(sassCompiler);

function livePreview(done) {
  browserSync.init(
  {     
    server: {
      baseDir: options.paths.dist.base,
    },
    port:  5000,
  });
  done();
}

//Copy latest installed Bulma
function setupBulma() {
  console.log("\n\t" + logSymbols.info, "Installing Bulma Files..\n");
  return src([nodepath + "bulma/*.sass", nodepath + "bulma/**/*.sass"]).pipe(
    dest("static/sass/")
  );
}



//Triggers Browser reload
function previewReload(done) {
  console.log(logSymbols.info, "Reloading Browser Preview.");
  browserSync.reload();
  done();
}


// Let's write our task in a function to keep things clean
function javascriptBuild() {
  // Start by calling browserify with our entry pointing to our main javascript file
  return (
    browserify({
      entries: [`${options.paths.src.js}/main.js`],
      // Pass babelify as a transform and set its preset to @babel/preset-env
      transform: [babelify.configure({ presets: ["@babel/preset-env"] })],
    })
      // Bundle it all up!
      .bundle()
      // Source the bundle
      .pipe(source("bundle.js"))
      // Then write the resulting files to a folder
      .pipe(dest(`static/dist/js`))
  );
}

//Compile HTML partials with Panini
function compileHTML() {
  console.log(logSymbols.info, "Compiling HTML..");
  panini.refresh();
  return src(__dirname+"/templates/**/*.html")
    .pipe(
      panini({
        root: "templates",
        layouts: "/static/layouts/",
        partials: "/static/partials/",
 
      })
    )
    .pipe(dest(__dirname+"/static/dist/"))
    .pipe(browserSync.stream());
}


function copyFonts() {
  console.log(logSymbols.info, "Copying fonts to dist folder.");
  return src(["static/fonts/*"])
    .pipe(dest("static/dist/fonts/"))
    .pipe(browserSync.stream());
}


function devClean() {
  console.log(logSymbols.info, "Cleaning dist folder for fresh start.");
  return del([options.paths.dist.base]);
}




//Compile Scss code
function compileSCSS() {
  console.log(logSymbols.info, "Compiling App SCSS..");
  return src(["static/scss/main.scss"])
    .pipe(
      sass({
        outputStyle: "compressed",
        sourceComments: "map",
        sourceMap: "scss",
        // includePaths: bourbon,
      }).on("error", sass.logError)
    )
    .pipe(autoprefixer("last 2 versions"))
    .pipe(dest("static/dist/css"))
    .pipe(browserSync.stream());
}

//Concat JS
function concatJs() {
  console.log(logSymbols.info, "Compiling Vendor Js..");
  return src(["static/js/*"])
    .pipe(sourcemaps.init())
    .pipe(concat("app.js"))
    .pipe(sourcemaps.write("./"))
    .pipe(dest("static/dist/js"))
    .pipe(browserSync.stream());
}


//Concat CSS Plugins
function concatCssPlugins() {
  console.log(logSymbols.info, "Compiling Plugin styles..");
  return src([
    nodepath + "simplebar/dist/simplebar.min.css",
    nodepath + "plyr/dist/plyr.css",
    nodepath + "codemirror/lib/codemirror.css",
    nodepath + "codemirror/theme/shadowfox.css",
    "static/vendor/css/*",
  ])
    .pipe(sourcemaps.init())
    .pipe(concat("app.css"))
    .pipe(sourcemaps.write("./"))
    .pipe(dest("static/dist/css"))
    .pipe(browserSync.stream());
}


//Reset Panini Cache
function resetPages(done) {
  console.log(logSymbols.info, "Clearing Panini Cache..");
  panini.refresh();
  done();
}

/*
//Triggers Browser reload
function previewReload(done) {
  console.log(logSymbols.info, "Reloading Browser Preview.");
  browserSync.init(
    [paths.src.css + "/*.css", paths.src.js + "*.js", paths.templates + '*.html'],
    {
      proxy:  "localhost:5000"
    }
  ).reload();
  done();
}
*/

//Copy images
function copyImages() {
  return src(`${options.paths.src.img}/**/*`).pipe(
    dest(options.paths.dist.img)
  );
}



//Optimize images
function optimizeImages() {
  return src(`${options.paths.src.img}/**/*`)
    .pipe(imagemin())
    .pipe(dest(options.paths.dist.img));
}


function watchFiles() {
  watch(
    `${options.paths.src.base}/**/*.html`,
    series( previewReload)
  ).on("change", reload);
  watch(["static/scss/**/*", "static/scss/*"], compileSCSS);
  watch(
    `${options.paths.src.js}/**/*.js`,
    series(javascriptBuild, previewReload)
  ).on("change", reload);
  watch(
    `${options.paths.src.fonts}/**/*`,
    series(copyFonts, previewReload)
  ).on("change", reload);
  watch(`${options.paths.src.img}/**/*`, series(copyImages, previewReload)).on("change", reload);
  console.log(logSymbols.info, "Watching for Changes..");
}





/*
// Build all files and watches for changes
gulp.task('build:watch', ['build', 'watch']);

// Build all files, run the server, start BrowserSync and watch for file changes
gulp.task('default', function () {
  runSequence('build', 'runServer', 'browserSync', 'watch');
});
*/

const buildTasks = [
  devClean,
  resetPages,
  parallel(
    concatJs,
    copyFonts,
    concatCssPlugins,
    compileSCSS,
    javascriptBuild,
    
  ),
];

export const build = (done) => {
  series( devClean,resetPages, parallel(...buildTasks, optimizeImages))();
  done();
};

export default (done) => {
  series(
    devClean,
    resetPages,
    parallel(...buildTasks, copyImages),
    parallel(livePreview,watchFiles),
    
  )();
  done();
};

export const setup = () => {
  series(setupBulma);
};

