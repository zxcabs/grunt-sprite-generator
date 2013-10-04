/*
 * grunt-sprite-generator
 * http://github.com/hollandben/grunt-sprite-generator
 *
 * Copyright (c) 2013 Ben Holland
 * Licensed under the MIT license.
 */

var spritesmith = require('spritesmith');

module.exports = function(grunt) {
    'use strict';

    var httpRegex = new RegExp('http[s]?', 'ig');
    var imageRegex = new RegExp('background-image:[\\s]?url\\(["\']?([\\w\\d\\s!:./\\-\\_]*\\.[\\w?#]+)["\']?\\)[^;]*\;', 'ig');
    var filepathRegex = new RegExp('["\']?([\\w\\d\\s!:./\\-\\_]*\\.[\\w?#]+)["\']?', 'ig');

    grunt.registerMultiTask('spriteGenerator', 'Grunt task that generates a sprite from images referenced in a stylesheet and then updates the references with the new sprite image and positions', function() {

        // Merge task-specific and/or target-specific options with these defaults.
        var options = this.options({
            algorithm: 'binary-tree',
            baseUrl: './',
            engine: 'auto',
            padding: 2,
            notFound: false
        });

        var done = this.async();

        // Collect all background-image references in a given file
        var collectImages = function(srcFile) {
            var images = [];
            var data = grunt.file.read(options.baseUrl + srcFile);


            var files = data.match(imageRegex);

            files.forEach(function(file) {
                // Exit if it contains a http/https
                if (httpRegex.test(file)) {
                    grunt.log.warn(file + ' has been skipped as it\'s an external resource!');
                    return false;
                }

                // Exit if not a PNG
                if (!/\.png/.test(file)) {
                    grunt.log.warn(file + ' has been skipped as it\'s not a PNG!');
                    return false;
                }

                var filepath = options.baseUrl + file.match(filepathRegex)[0].replace(/['"]/g, '');

                if (grunt.file.exists(filepath)) {
                    images[filepath] = file;
                } else {
                    grunt.log.warn(filepath + ' has been skipped as it does not exist!');
                }
            });

            return images;
        };

        var spriteSmithWrapper = function(config, callback) {
            var dest = options.dest;
            var defaultConfig = {
                algorithm: options.algorithm,
                engine: options.engine,
                exportOpts: {
                    format: 'png'
                },
                padding: options.padding
            };

            grunt.util._.defaults(config, defaultConfig);

            spritesmith(config, function(err, result) {

                if (err) {
                    grunt.fatal(err);
                    return callback(err);
                } else {
                    grunt.file.write(dest, result.image, {
                        encoding: 'binary'
                    });

                    var tmpResult = result.coordinates;
                    var coords = [];

                    for(var key in tmpResult) {
                        coords[key] = {
                            x: tmpResult[key].x,
                            y: tmpResult[key].y
                        };
                    }

                    callback(false, coords);
                }
            });
        };

        var updateReferences = function(filepath, spritePath, arr, callback) {
            var data = grunt.file.read(filepath);

            arr.forEach(function(obj) {
                var newRef = 'background-image: url(\''+ spritePath +'\');\n    background-position: -'+ obj.coords.x +'px -'+ obj.coords.y +'px;';
                data = data.replace(obj.ref, newRef);
            });

            grunt.file.write(filepath, data);

            // callback();
        };


        this.files.forEach(function(file) {
            var fileDest = file.dest;
            options.dest = options.baseUrl + fileDest;

            var src = file.src.filter(function(filepath) {
                // Warn on and remove invalid source files (if nonull was set).
                if (!grunt.file.exists(filepath)) {
                    grunt.log.warn('Source file "' + filepath + '" not found.');
                    return false;
                } else {
                    return true;
                }
            });

            // Process starter
            var collection = collectImages(src);

            grunt.util.async.map([{
                src: grunt.util._.keys(collection)
            }], spriteSmithWrapper, function(err, results) {
                if (err) {
                    console.log(err);
                }

                src.forEach(function(file) {
                    var refs = [];

                    results.forEach(function(result, i) {
                        grunt.util._.keys(result).map(function(key) {
                            refs.push({
                                src: key,
                                ref: collection[key],
                                coords: {
                                    x: result[key].x,
                                    y: result[key].y
                                }
                            });
                        });
                    });

                    updateReferences(file, fileDest, refs);
                });

                done();
            });
        });
    });
};