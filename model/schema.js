var chance =  new (require('chance'))();
var Q = require('q');
var http = require('request-q');
var fixedEncodeURIComponent = function(str) {
	return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
		return '%' + c.charCodeAt(0).toString(16).toUpperCase();
	});
};


/* @namespace Schema
 * @desc
 * The Schema module allows you to create and delete schemas for the ERMrest API
 * service.
 * @param {options} A json object which should contain a catalog and  optionally the name of the schema { catalog: @Catalog, name: 'schema_name' }.
 * @constructor
 */
var Schema = function(options) {
	options = options || {};
	this.url = options.url;
	this.content = options.schema || {};
	this.entityCount = this.content.entityCount || 0;
	this.catalog = options.catalog || {};
	this.name = this.content.schema_name || this.content.name || chance.string().replace(/[^a-zA-Z ]/g, "");
};

/**
 * @param {schemaName} Optional : Used if you didn't provide while creating the object
 * @returns {Promise} Returns a promise.
 * @desc
 * An asynchronous method that returns a promise. If fulfilled, it creates a new schema.
 */
Schema.prototype.create = function(schemaName) {
	var defer = Q.defer(), self = this;
	this.name = schemaName || this.name;
	if (!this.catalog.id || !this.name) return defer.reject("No Catalog or Name set : create schema function"), defer.promise;
	http.post(this.url + '/catalog/' + this.catalog.id + "/schema/" + this.name).then(function(response) {
		return self.createAnnotation();
	}).then(function() {
		defer.resolve(self);
	}, function(err) {
		defer.reject(err, self);
	});

	return defer.promise;
};

/**
 *
 * @desc
 * Delete a schema.
 */
Schema.prototype.remove = function() {
	var defer = Q.defer(), self = this;
	if (!this.catalog.id || !this.name) return defer.reject("No Catalog or Name set: remove schema function"), defer.promise;
	
	http.delete(this.url + '/catalog/' + this.catalog.id + "/schema/" + this.name).then(function() {
		defer.resolve(self);
	}, function(err) {
		defer.reject(err, self);
	});

	return defer.promise;
};

var annotate = function(self, key, value) {
	var d = Q.defer();
	http.put(self.url + '/catalog/' + self.catalog.id + "/schema/" + self.name + "/annotation/" + fixedEncodeURIComponent(key), value).then(function(response) {
		d.resolve();
	}, function(err) {
		d.reject(err);
	});
	return d.promise;
};

/**
 *
 * @desc
 * Create annotations specified in the content.
 */
Schema.prototype.createAnnotation = function() {
	var annotations = this.content.annotations || {}, defer = Q.defer(), self = this, promises = [];
	for (var k in annotations) {
		if (annotations[k] != null) promises.push(annotate(self, k, annotations[k]));
	}

	Q.all(promises).then(function() {
		defer.resolve(self);
	}, function(err) {
		defer.reject(err);
	});
	return defer.promise;
};

/**
 *
 * @desc
 * Sets and Returns the default table for a schema.
 */
Schema.prototype.setDefaultTable = function() {
	var defaultTable = null, rootTables = [], tables = this.content.tables;

	for (var k in tables) {
		table = tables[k];
		var exclude = table['annotations'] != null && table['annotations']['comment'] != null &&
			(table['annotations']['comment'].contains('exclude') || table['annotations']['comment'].contains('association'));
		var nested = table['annotations'] != null && table['annotations']['comment'] != null &&
			table['annotations']['comment'].contains('nested');
		
		if (!exclude && !nested) {
			rootTables.push(table['table_name']);
			if (table['annotations'] != null && table['annotations']['comment'] != null && table['annotations']['comment'].contains('default')) {
				defaultTable = table;
			}
		}
	};
	
	if (defaultTable == null) defaultTable = tables[rootTables[0]];
	this.defaultTable = defaultTable;
	return this.defaultTable;
};

/**
 *
 * @desc
 * Not yet implemented.
 */
Schema.prototype.get = function() {
	throw new Error("Not Implemented");
}

module.exports = Schema;