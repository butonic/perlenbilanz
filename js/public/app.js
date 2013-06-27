'use strict';

/* App Module */

angular.module('perlenbilanz', ['perlenbilanzServices', 'ui.directives']).
	config(['$interpolateProvider', '$routeProvider', function ($interpolateProvider, $routeProvider) {
		$interpolateProvider.startSymbol('[[');
		$interpolateProvider.endSymbol(']]');
		$routeProvider.
			when('/', {templateUrl: 'templates/partials/uebersicht.php', controller: UebersichtCtrl}).
			when('/einkauf', {templateUrl: 'templates/partials/einkauf.php', controller: EinkaufCtrl}).
			when('/einkauf/:id', {templateUrl: 'templates/partials/einkauf.php', controller: EinkaufCtrl}).
			when('/verkauf', {templateUrl: 'templates/partials/verkauf.php', controller: VerkaufCtrl}).
			when('/verkauf/:id', {templateUrl: 'templates/partials/verkauf.php', controller: VerkaufCtrl}).
			when('/einkaeufe', {templateUrl: 'templates/partials/offeneeinkaeufe.php', controller: EinkaufPositionCtrl}).
			when('/verkaeufe', {templateUrl: 'templates/partials/offeneverkaeufe.php', controller: VerkaeufeCtrl}).
			when('/wertstellungen', {templateUrl: 'templates/partials/wertstellungen.php', controller: WertstellungenCtrl}).
			otherwise({redirectTo: '/'});
	}]);

/* Controllers */

function MenuCtrl($scope, $window) {

	$scope.reportDate = new Date();
	$scope.reportDate.setDate(1);
	$scope.reportDate.setMonth($scope.reportDate.getMonth()-1);

	$scope.reportYear = ''+$scope.reportDate.getFullYear();
	if ($scope.reportDate.getMonth() < 10) {
		$scope.reportMonth = '0'+$scope.reportDate.getMonth();
	} else {

		$scope.reportMonth = ''+$scope.reportDate.getMonth();
	}

	$scope.generateReport = function () {
		//FIXME this is a bad hack but I could not yet find an angular way of generating urls
		$window.open('report?requesttoken='+oc_requesttoken+'&year='+$scope.reportYear+'&month='+$scope.reportMonth);
	};
	$scope.updateReportDate = function (year, month) {
		$scope.reportYear = ''+year;
		if (month < 10) {
			$scope.reportMonth = '0'+month;
		} else {

			$scope.reportMonth = ''+month;
		}
	};


}

function UebersichtCtrl($scope, $location, NotesResource, $timeout, VerkaufResource, EinkaufResource) {
	$scope.verkaeufe = VerkaufResource.query({overview:'current'},function(response){
		$scope.vkBrutto = 0;
		$scope.vkMwSt = 0;
		$scope.vkNetto = 0;
		angular.forEach(response, function(entry) {
			if (entry.wertstellung !== null) {
				$scope.vkBrutto += entry.brutto;
				$scope.vkMwSt += entry.mwst;
				$scope.vkNetto += entry.netto;
			}
		});
	});
	$scope.einkaeufe = EinkaufResource.query({overview:'current'},function(response){
		$scope.ekBrutto = 0;
		$scope.ekMwSt = 0;
		$scope.ekNetto = 0;
		angular.forEach(response, function(entry) {
			if (entry.wertstellung !== null) {
				$scope.ekBrutto += entry.brutto;
				$scope.ekMwSt += entry.mwst;
				$scope.ekNetto += entry.netto;
			}
		});
	});
	$scope.editEinkauf = function (id) {
		$location.path('/einkauf/'+id);
	};
	$scope.editVerkauf = function (id) {
		$location.path('/verkauf/'+id);
	};
	$scope.calcBruttoSum = function (positionen) {
		var brutto = 0;
		angular.forEach(positionen, function(entry) {
			brutto += entry.brutto;
		});
		return brutto;
	};
	$scope.calcMwStSum = function (positionen) {
		var mwst = 0;
		angular.forEach(positionen, function(entry) {
			mwst += entry.mwst;
		});
		return mwst;
	};
	$scope.calcNettoSum = function (positionen) {
		var netto = 0;
		angular.forEach(positionen, function(entry) {
			netto += entry.netto;
		});
		return netto;
	};
	NotesResource.get(function(response){
		$scope.notes = response.text;
	});

	$scope.saveNotes = function () {
		if ($scope.saveTimeout) {
			$timeout.cancel($scope.saveTimeout);
		}
		$scope.saveTimeout = $timeout(function () {
			NotesResource.save({text:$scope.notes},function(response){}, function(error){
				alert('could not save notes');
			});
		}, 1000); //autosave after 2 sec
	};
}

function EinkaufCtrl($scope, $location, $filter, $routeParams, EinkaufResource, EinkaufPositionResource, accountNameRecommender, mwstCalculator) {
	$scope.types = [
		{id:"Ware",text:"Ware"},
		{id:"Versand",text:"Versand"},
		{id:"Porto/Versandmaterial",text:"Porto/Versandmaterial"},
		{id:"Büromaterial",text:"Büromaterial"},
		{id:"Gebühren",text:"Gebühren"},
		{id:"Buchhaltung",text:"Buchhaltung"},
		{id:"Sonstige",text:"Sonstige"}
	];
	$scope.accountOptions = {
		query: function (query) {
			var data = {results: []};
			var items = $scope.accounts;
			if ($scope.guessedAccounts) {
				items = $scope.guessedAccounts;
			}
			angular.forEach(items, function(item, key){
				if (query.term.toUpperCase() === item.text.substring(0, query.term.length).toUpperCase()) {
					data.results.push(item);
				}
			});
			query.callback(data);
		},
		createSearchChoice: function (term) {
			return {id:term,text:term};
		},
		initSelection : function (element, callback) {
			var data = {id: element.val(), text: element.val()};
			callback(data);
		},
		placeholder: "",
		allowClear: true
	};
	$scope.nameOptions = {
		query: function (query) {
			var data = {results: []};
			var items = $scope.names;
			if ($scope.guessedNames) {
				items = $scope.guessedNames;
			}
			angular.forEach(items, function(item, key){
				if (query.term.toUpperCase() === item.text.substring(0, query.term.length).toUpperCase()) {
					data.results.push(item);
				}
			});
			query.callback(data);
		},
		createSearchChoice: function (term) {
			return {id:term,text:term};
		},
		initSelection : function (element, callback) {
			var data = {id: element.val(), text: element.val()};
			callback(data);
		},
		placeholder: "",
		allowClear: true
	};
	$scope.guessAccounts = function() {
		accountNameRecommender.guessAccounts($scope, $scope.einkauf, EinkaufResource);
	};
	$scope.guessNames = function() {
		accountNameRecommender.guessNames($scope, $scope.einkauf, EinkaufResource);
	};
	$scope.newEinkauf = function () {
		$scope.guessedAccounts = null;
		$scope.guessedNames = null;
		accountNameRecommender.fetchAccounts($scope, EinkaufResource);
		accountNameRecommender.fetchNames($scope, EinkaufResource);
		$scope.einkauf = new EinkaufResource();
		$scope.einkauf.plattform = 'eBay';
		$scope.einkauf.zahlweise = 'PayPal';
		$scope.positionen = [];
		$scope.addPosition(0);
	};
	$scope.saveEinkauf = function () {

		$scope.einkauf.$save(function (data) {
			//update the model with the entity returned from the server
			$scope.einkauf = new EinkaufResource(data);

			//save positions with id from einkauf
			angular.forEach($scope.positionen, function(position) {
				//update id
				position.ekId = $scope.einkauf.id;

				//FIXME wie position löschen?
				// FIXME Reihenfolge der positionen hängt von eingang auf der serverseite ab
				new EinkaufPositionResource(position).$save(function (data) {
					//update the model with the entity returned from the server
					position = new EinkaufPositionResource(data);
				});
			});
			alert('Gespeichert');
			$location.path('/einkauf');
			$scope.newEinkauf();
		});
	};
	$scope.addPosition = function (index) {
		$scope.positionen.splice(index+1, 0, {
			datum: $filter('date')(new Date(),'yyyy-MM-dd'),
			typ:'Ware',
			bezeichnung:'',
			geliefert:false,
			mwstProzent:0
		});
	};
	$scope.removePosition = function (index) {
		$scope.positionen.splice(index, 1);
		//FIXME wie löschen?
	};
	$scope.$watch('positionen', function(current, previous) {
		mwstCalculator.update($scope, current);
	}, true);
	$scope.updateBrutto = function (position) {
		mwstCalculator.updateBrutto(position);
	};
	$scope.updateMwSt = function (position) {
		mwstCalculator.updateMwSt(position);
	};
	$scope.updateMwStProzent = function (position) {
		mwstCalculator.updateMwStProzent(position);
	};

	if ($routeParams.id) {
		accountNameRecommender.fetchAccounts($scope, EinkaufResource);
		accountNameRecommender.fetchNames($scope, EinkaufResource);
		$scope.einkauf = EinkaufResource.get({id:$routeParams.id}, function(data){
			$scope.guessNames();
			$scope.guessAccounts();
		});
		$scope.positionen = EinkaufPositionResource.query({ekId:$routeParams.id});
	} else {
		$scope.newEinkauf();
	};
}
//EinkaufCtrl.$inject = ['$scope', 'EinkaufResource'];params:

function VerkaufCtrl($scope, $location, $filter, $routeParams, VerkaufResource, VerkaufPositionResource, accountNameRecommender, mwstCalculator) {
	$scope.types = [
		{id:"Ware",text:"Ware"},
		{id:"Versand",text:"Versand"},
		{id:"Aufschlag",text:"Aufschlag"},
		{id:"Rabatt",text:"Rabatt"},
		{id:"Sonstige",text:"Sonstige"}
	];
	$scope.accountOptions = {
		query: function (query) {
			var data = {results: []};
			var items = $scope.accounts;
			if ($scope.guessedAccounts) {
				items = $scope.guessedAccounts;
			}
			angular.forEach(items, function(item, key){
				if (query.term.toUpperCase() === item.text.substring(0, query.term.length).toUpperCase()) {
					data.results.push(item);
				}
			});
			query.callback(data);
		},
		createSearchChoice: function (term) {
			return {id:term,text:term};
		},
		initSelection : function (element, callback) {
			var data = {id: element.val(), text: element.val()};
			callback(data);
		},
		placeholder: "",
		allowClear: true
	};
	$scope.nameOptions = {
		query: function (query) {
			var data = {results: []};
			var items = $scope.names;
			if ($scope.guessedNames) {
				items = $scope.guessedNames;
			}
			angular.forEach(items, function(item, key){
				if (query.term.toUpperCase() === item.text.substring(0, query.term.length).toUpperCase()) {
					data.results.push(item);
				}
			});
			query.callback(data);
		},
		createSearchChoice: function (term) {
			return {id:term,text:term};
		},
		initSelection : function (element, callback) {
			var data = {id: element.val(), text: element.val()};
			callback(data);
		},
		placeholder: "",
		allowClear: true
	};
	$scope.guessAccounts = function() {
		accountNameRecommender.guessAccounts($scope, $scope.verkauf, VerkaufResource);
	};
	$scope.guessNames = function() {
		accountNameRecommender.guessNames($scope, $scope.verkauf, VerkaufResource);
	};
	$scope.newVerkauf = function () {
		$scope.guessedAccounts = null;
		$scope.guessedNames = null;
		accountNameRecommender.fetchAccounts($scope, VerkaufResource);
		accountNameRecommender.fetchNames($scope, VerkaufResource);
		$scope.verkauf = new VerkaufResource();
		$scope.verkauf.plattform = 'fancywork';
		$scope.verkauf.zahlweise = 'Konto';
		$scope.positionen = [];
		$scope.addPosition(0);
	};
	$scope.saveVerkauf = function () {
		$scope.verkauf.$save(function (data) {
			//update the model with the entity returned from the server
			$scope.verkauf = new VerkaufResource(data);

			//save positions with id from verkauf
			angular.forEach($scope.positionen, function(position) {
				//update id
				position.vkId = $scope.verkauf.id;

				new VerkaufPositionResource(position).$save(function (data) {
					//update the model with the entity returned from the server
					position = new VerkaufPositionResource(data);
				});
			});
			alert('Gespeichert');
			$location.path('/verkauf');
			$scope.newVerkauf();
		});
	};
	$scope.addPosition = function (index) {
		$scope.positionen.splice(index+1, 0, {
			datum: $filter('date')(new Date(),'yyyy-MM-dd'),
			stueck:1,
			typ:'Ware',
			bezeichnung:'',
			geliefert:false,
			mwstProzent:19
		});
	};
	$scope.removePosition = function (index) {
		$scope.positionen.splice(index, 1);
	};
	$scope.$watch('positionen', function(current, previous) {
		mwstCalculator.update($scope, current);
	}, true);
	$scope.updateBrutto = function (position) {
		mwstCalculator.updateBrutto(position);
	};
	$scope.updateMwSt = function (position) {
		mwstCalculator.updateMwSt(position);
	};

	if ($routeParams.id) {
		accountNameRecommender.fetchAccounts($scope, VerkaufResource);
		accountNameRecommender.fetchNames($scope, VerkaufResource);
		$scope.verkauf = VerkaufResource.get({id:$routeParams.id}, function(data){
			$scope.guessNames();
			$scope.guessAccounts();
		});
		$scope.positionen = VerkaufPositionResource.query({vkId:$routeParams.id});
	} else {
		$scope.newVerkauf();
	};
}

function EinkaufPositionCtrl($scope, $location, $filter, $routeParams, EinkaufResource, EinkaufPositionResource, mwstCalculator) {
	$scope.positionen = EinkaufPositionResource.query({geliefert:false}, function (positionen) {
		//fetch plattform
		angular.forEach(positionen, function(position) {
			EinkaufResource.get({id:position.ekId},function(data){
				position.plattform = data.plattform;
			});
		});
	});
	$scope.savePositionen = function () {
		//save positions with id from einkauf
		angular.forEach($scope.positionen, function(position) {
			position.$save(function (data) {
				//update the model with the entity returned from the server
				position = new EinkaufPositionResource(data);
			});
		});
		alert('Gespeichert');
		$scope.positionen = EinkaufPositionResource.query({geliefert:false});
	};
	$scope.updateMwSt = function (position) {
		mwstCalculator.updateMwSt(position);
	};
}

function VerkaeufeCtrl($scope, $location, $filter, $routeParams, VerkaufResource, VerkaufPositionResource) {
	$scope.verkaeufe = VerkaufResource.query({geliefert:false});
}
function WertstellungenCtrl($scope, $location, $filter, $routeParams, VerkaufResource, EinkaufResource) {
	$scope.einkaeufe = EinkaufResource.query({wertstellung:null});
	$scope.verkaeufe = VerkaufResource.query({wertstellung:null});
	$scope.save = function () {
		angular.forEach($scope.einkaeufe, function(einkauf) {
			einkauf.$save();
		});
		angular.forEach($scope.verkaeufe, function(verkauf) {
			verkauf.$save();
		});
		alert('Gespeichert');
		$scope.einkaeufe = EinkaufResource.query({wertstellung:null});
		$scope.verkaeufe = VerkaufResource.query({wertstellung:null});
	};
}

// from the angularjs docs: http://docs.angularjs.org/guide/forms
var INTEGER_REGEXP = /^\-?\d*$/;
angular.module('perlenbilanz').directive('integer', function() {
	return {
		require: 'ngModel',
		link: function(scope, elm, attrs, ctrl) {
			ctrl.$parsers.unshift(function(viewValue) {
				if (INTEGER_REGEXP.test(viewValue)) {
					// it is valid
					ctrl.$setValidity('integer', true);
					if (viewValue === '') {
						return null;
					}
					return parseInt(viewValue);
				} else {
					// it is invalid, return undefined (no model update)
					ctrl.$setValidity('integer', false);
					return undefined;
				}
			});
		}
	};
});

/*
see http://stackoverflow.com/a/1296071/828717
^[+-]?[0-9]{1,3}
(?:
    (?:\,[0-9]{3})*
    (?:.[0-9]{2})?
|
    (?:\.[0-9]{3})*
    (?:\,[0-9]{2})?
|
    [0-9]*
    (?:[\.\,][0-9]{2})?
)$
 */
// matches 1,000.23
var FLOAT_REGEXP_DOT = /^[+-]?[0-9]{1,3}(?:(?:\,[0-9]{3})*(?:\.[0-9][0-9]?)?|[0-9]*(?:[\.][0-9][0-9]?)?)$/;
//matches 1.000,23
var FLOAT_REGEXP_COMMA = /^[+-]?[0-9]{1,3}(?:|(?:\.[0-9]{3})*(?:\,[0-9][0-9]?)?|[0-9]*(?:[\,][0-9][0-9]?)?)$/;
var FLOAT_REGEXP = /^\-?\d+((\.|\,)\d+)?$/;
angular.module('perlenbilanz').directive('smartFloat', function() {
	return {
		require: 'ngModel',
		link: function(scope, elm, attrs, ctrl) {
			ctrl.$parsers.unshift(function(viewValue) {
				if (FLOAT_REGEXP.test(viewValue)) {
					ctrl.$setValidity('float', true);
					return parseFloat(viewValue.replace(',', '.'));
				} else {
					ctrl.$setValidity('float', false);
					return undefined;
				}
			});
		}
	};
});

//currency input field from from http://jsfiddle.net/odiseo/dj6mX/
String.prototype.splice = function(idx, rem, s) {
	return (this.slice(0, idx) + s + this.slice(idx + Math.abs(rem)));
};

angular.module('perlenbilanz').directive('currencyInput', function() {
	return {
		require: 'ngModel',
		link: function(scope, elm, attrs, ctrl) {

			//filter key events
			$(elm).keydown(function(event) {
				var keyCode = ('which' in event) ? event.which : event.keyCode;
				if (event.ctrlKey && (keyCode === 67 || keyCode === 88 || keyCode === 86)) {
					return true;
				} else if ((keyCode >= 96 && keyCode <= 105) || keyCode === 109 || keyCode === 110) { /* numpad 0..9 DOM_VK_SUBTRACT(109,-) DOM_VK_DECIMAL(110,.) */
					return true;
				} else if (keyCode >= 188 && keyCode <= 190) { /* , . DOM_VK_COMMA(188,-) DOM_VK_PERIOD(190,.) */ 
					return true;
				} else if (keyCode === 173) { /* DOM_VK_HYPHEN_MINUS(173,-) */
					return true;
				} else if (keyCode >= 58) { /* DOM_VK_COLON(58,:) */
					return false;
				}
				return true;
			});
			ctrl.$parsers.unshift(function(viewValue) {
				if (FLOAT_REGEXP_COMMA.test(viewValue)) {
					var clean = viewValue.replace(/\./g, '').replace(/,/g, '.');
					ctrl.$setValidity('float', true);
					return parseFloat(clean);
				} else if (FLOAT_REGEXP_DOT.test(viewValue)) {
					var clean = viewValue.replace(/\,/g, '');
					ctrl.$setValidity('float', true);
					return parseFloat(clean);
				} else {
					ctrl.$setValidity('float', false);
					return undefined;
				}
			});
			// model -> view
			ctrl.$render = function(){
				// render float as string
				var result = '';

				if (typeof ctrl.$viewValue === 'number') {

					var value = ctrl.$viewValue;
					value = ''+Math.round(value*100)/100;

					var decimalSplit = value.split('.');
					var intPart = decimalSplit[0];
					var decPart = decimalSplit[1];

					if (intPart.length > 3) {
						var intDiv = Math.floor(intPart.length / 3);
						while (intDiv > 0) {
							var lastPoint = intPart.indexOf(".");
							if (lastPoint < 0) {
								lastPoint = intPart.length;
							}

							if (lastPoint - 3 > 0) {
								intPart = intPart.splice(lastPoint - 3, 0, '.');
							}
							intDiv--;
						}
					}

					if (decPart === undefined) {
						decPart = '';
					} else {
						if (decPart.length === 1) {
							decPart = decPart + '0';
						}
						if (decPart.length > 2) {
							decPart = decPart.substr(0,2);
							}
						decPart = ',' + decPart;
					}
					result = intPart + decPart;
				}

				elm.val(result);
			};
		}
	};
});

angular.module('perlenbilanz').directive('autoComplete', function($filter, $timeout) {
	return {
		restrict: 'A',
		link: function(scope, elem, attr, ctrl) {
			elem.autocomplete({
				//source: scope[iAttrs.uiItems],
				source: function(request, response) {
					response( $filter('filter')(scope[attr.uiItems], request.term) );
				},
				select: function() {
					$timeout(function() {
						elem.trigger('input');
					}, 0);
				}
			});
		}
	};
});
/* Filters */
angular.module('perlenbilanz').filter('number_de', function() {
	return function(input) {
		if (typeof input === 'undefined' || input === null) {
			return '';
		} else if (typeof input === 'number') {
			input = ''+Math.round(input*100)/100;
		}

		var decimalSplit = input.split('.');
		var intPart = decimalSplit[0];
		var decPart = decimalSplit[1];

		intPart = intPart.replace(/[^\d-+]/g, '');
		if (intPart.length > 3) {
			var intDiv = Math.floor(intPart.length / 3);
			while (intDiv > 0) {
				var lastPoint = intPart.indexOf(".");
				if (lastPoint < 0) {
					lastPoint = intPart.length;
				}

				if (lastPoint - 3 > 0) {
					intPart = intPart.splice(lastPoint - 3, 0, '.');
				}
				intDiv--;
			}
		}

		if (decPart === undefined) {
			decPart = ',00';
		} else {
			if (decPart.length > 2) {
				decPart = decPart.substr(0,2);
			} else if (decPart.length === 1) {
				decPart = decPart + '0';
			}
			decPart = ',' + decPart;
		}
		var res = intPart + decPart;
		
		return res;
	};
});

angular.module('perlenbilanz').filter('exists', function() {
	return function(input) {
		if (typeof input === 'undefined') {
			return false;
		} else {
			return true;
		}
	};
});
angular.module('perlenbilanz').filter('notnull', function() {
	return function(input) {
		if (typeof input !== 'undefined' && input === null) {
			return false;
		} else {
			return true;
		}
	};
});
angular.module('perlenbilanz').filter('empty', function() {
	return function(input) {
		if (typeof input === 'undefined'
			|| (typeof input === 'object' &&  input === null)
			|| (typeof input === 'string' &&  input === '')
		){
			return true;
		} else {
			return false;
		}
	};
});
/*

 Resources - The default set contains these actions:
 { 'get':    {method:'GET'},
 'save':   {method:'POST'},
 'query':  {method:'GET', isArray:true},
 'remove': {method:'DELETE'},
 'delete': {method:'DELETE'} };

*/
angular.module('perlenbilanzServices', ['ngResource']).
	factory('NotesResource', function($resource){
		return $resource('ajax/notes', {id:'@id', requesttoken:oc_requesttoken});
	}).
	factory('EinkaufResource', function($resource){
		return $resource('ajax/einkauf/:id', {id:'@id', requesttoken:oc_requesttoken},
			{listAccounts:{method:'GET',params:{list:'accounts'}},
				listNames:{method:'GET',params:{list:'names'}},
				guessName:{method:'GET',params:{guess:'name'}},
			 guessAccount:{method:'GET',params:{guess:'account'}}});
	}).
	factory('EinkaufPositionResource', function($resource){
		return $resource('ajax/einkaufposition/:id', {id:'@id', requesttoken:oc_requesttoken});
	}).
	factory('VerkaufResource', function($resource){
		return $resource('ajax/verkauf/:id', {id:'@id', requesttoken:oc_requesttoken},
			{listAccounts:{method:'GET',params:{list:'accounts'}},
				listNames:{method:'GET',params:{list:'names'}},
				guessName:{method:'GET',params:{guess:'name'}},
			 guessAccount:{method:'GET',params:{guess:'account'}}});
	}).
	factory('VerkaufPositionResource', function($resource){
		return $resource('ajax/verkaufposition/:id', {id:'@id', requesttoken:oc_requesttoken});
	}).
	factory('accountNameRecommender', function(){
		var accountNameRecommender = {};
		accountNameRecommender.fetchAccounts = function ($scope, Resource) {
			Resource.listAccounts(function(response){
				$scope.accounts = [];
				angular.forEach(response, function(entry) {
					$scope.accounts.push({id:entry,text:entry});
				});
			});
		};
		accountNameRecommender.fetchNames = function ($scope, Resource) {
			Resource.listNames(function(response){
				$scope.names = [];
				angular.forEach(response, function(entry) {
					$scope.names.push({id:entry,text:entry});
				});
			});
		};
		accountNameRecommender.guessAccounts = function ($scope, instance, Resource) {
			if (instance.name === '') {
				$scope.guessedAccounts = null;
			} else {
				Resource.guessAccount({plattform:instance.plattform, name:instance.name},function (data) {
					$scope.guessedAccounts = [];
					angular.forEach(data, function(entry) {
						$scope.guessedAccounts.push({id:entry,text:entry});
					});
					if ($scope.guessedAccounts.length === 1 && !instance.account) {
						instance.account = $scope.guessedAccounts[0].id;
					}
				});
			}
		};
		accountNameRecommender.guessNames = function($scope, instance, Resource) {
			if (instance.account === '') {
				$scope.guessedNames = null;
			} else {
				Resource.guessName({plattform:instance.plattform, account:instance.account},function (data) {
					$scope.guessedNames = [];
					angular.forEach(data, function(entry) {
						$scope.guessedNames.push({id:entry,text:entry});
					});
					if ($scope.guessedNames.length === 1 && !instance.name ) {
						instance.name = $scope.guessedNames[0].id;
					}
				});
			}
		};
		return accountNameRecommender;
	}).
	factory('mwstCalculator', function() {
		var mwstCalculator = {};
		mwstCalculator.update = function($scope, positions) {
			var bruttoTotal = 0;
			var mwstGroups = new Array();
			if (positions) {
				$.each(positions, function (i, position) {
					var brutto = position.brutto;
					if (typeof brutto === 'undefined') {
						brutto = 0;
					}
					
					if (position.typ === 'Rabatt' && brutto > 0) {
						brutto = brutto * -1;
						position.brutto = brutto;
					}
					bruttoTotal += brutto;
					
					var mwstProzent = 0;
					if (typeof position.mwstProzent === 'number') {
						mwstProzent = position.mwstProzent;
					} else if ((typeof position.mwstProzent === 'string' && position.mwstProzent === '' )
						|| (typeof position.mwstProzent === 'object' && position.mwstProzent === null )) {
						//calculate mwst & netto with old mwstStatus
						mwstProzent = 'various';
						position.netto = brutto-position.mwst;
					} else {
						if (typeof position.mwstStatus !== 'undefined') {
							if (position.mwstStatus === true) {
								mwstProzent = 19;
							}
						}
					}

					//add netto to existing group
					var newGroup = true;
					$.each(mwstGroups, function (i, mwstGroup) {
						if (mwstGroup.mwstProzent === mwstProzent) {
							mwstGroup.brutto += brutto;
							if (mwstProzent === 'various') {
								mwstGroup.netto += position.netto;
								mwstGroup.mwst += position.mwst;
							}
							newGroup=false;
						}
					});
					//create new group
					if (newGroup) {
						if (mwstProzent === 'various') {
							mwstGroups.push({
								mwstProzent:mwstProzent,
								brutto:brutto,
								mwst:position.mwst,
								netto:position.netto});
						} else {
							mwstGroups.push({mwstProzent:mwstProzent,brutto:brutto});
						}
					}
				});
			}

			var mwstTotal = 0;
			$.each(mwstGroups, function (i, mwstGroup) {
				if (mwstGroup.mwstProzent === 'various') {
					//already calculated, just round
					mwstGroup.mwst = Math.round(mwstGroup.mwst*100)/100;
				} else {
					mwstGroup.mwst = Math.round((mwstGroup.brutto-(mwstGroup.brutto / (1+mwstGroup.mwstProzent/100)))*100)/100;
				}
				mwstTotal += mwstGroup.mwst;
			});


			$scope.bruttoTotal = Math.round(bruttoTotal*100)/100;
			$scope.mwstGroups = mwstGroups;
			$scope.nettoTotal = Math.round((bruttoTotal-mwstTotal)*100)/100;
		};
		mwstCalculator.updateBrutto = function(position) {
			var brutto = position.brutto;
			if (brutto == null) {
				brutto = 0;
			}
			if (typeof brutto === 'number') {
				var mwstProzent = 0;
				var netto = 0;
				if (typeof position.mwstProzent === 'number') {
					mwstProzent = position.mwstProzent;
					netto = brutto / (1+mwstProzent/100);
				} else if (typeof position.mwstProzent === 'string' && position.mwstProzent === '' ) {
					//calculate mwst & netto with old mwstStatus
					netto = brutto-position.mwst;
				} else {
					if (typeof position.mwstStatus !== 'undefined') {
						if (position.mwstStatus === true) {
							mwstProzent = 19;
						}
					}
					netto = brutto / (1+mwstProzent/100);
				}
				var mwst = brutto - netto;
				position.netto = netto;
				position.mwst = mwst;
			}
		};
		mwstCalculator.updateMwSt = function(position) {
			var brutto = position.brutto;
			if (brutto == null) {
				brutto = 0;
			}
			if (typeof brutto === 'number') {
				var mwstProzent = 0;
				if (typeof position.mwstStatus !== 'undefined') {
					if (position.mwstStatus === true) {
						position.mwstProzent = 19;
					} else {
						position.mwstProzent = 0;
					}
					mwstProzent = position.mwstProzent;
				}
				if (typeof position.mwstProzent === 'number') {
					mwstProzent = position.mwstProzent;
				}
				var netto = brutto / (1+mwstProzent/100);
				var mwst = brutto - netto;
				position.netto = netto;
				position.mwst = mwst;
			}
		};
		mwstCalculator.updateMwStProzent = function(position) {
			var brutto = position.brutto;
			if (brutto == null) {
				brutto = 0;
			}
			if (typeof brutto === 'number') {
				var mwstProzent = position.mwstProzent;
				if (mwstProzent == null) {
					if (position.mwstStatus === true) {
						mwstProzent = 19;
					} else {
						mwstProzent = 0;
					}
				}
				var netto = brutto / (1+mwstProzent/100);
				var mwst = brutto - netto;
				position.netto = netto;
				position.mwst = mwst;
			}
		};
		return mwstCalculator;
	});