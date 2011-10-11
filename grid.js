/*  ATMCASHgrid
 *
 *  ATMCASHgrid is freely distributable under the terms of an MIT-style license.
 *  ATMCASHgrid is brought to you kindly by http://www.ATMCash.com
 *
 *--------------------------------------------------------------------------*/


var grids = $H();
var Grids = Class.create(
/** @lends Grids# */
{
    /**
     * @fileoverview Constructs an ATMCASHgrid object
     * @version 0.4.5
     * @author (c) 2011 Ran Grushkowsky
     * @requires Prototype 1.6.1.0
     * @class Creates a dynamic javascript grid
     * @param {String} name The id of the Element that is going to contain the grid
     * @param {Hash} settings Settings that can configure the grid.
     * @example <b><u>Settings:</u></b>
     * <b>recs_per_page</b> : The number of records to be displayed in each page
     * <b>pages_cached</b> : How many pages should it cache everytime it goes to the server
     * <b>min_width</b> : The minimum column width
     * <b>theme</b> : The theme class to be used
     * <b>onLoadFnc</b> : A function to be called everytime a page finishes loading. {@see <a href=#onLoad>#onLoad</a>}
     * @example <b><u>Example:</u></b>
     * new Grids('testGrid',{'recs_per_page':3}).onLoad(function(){alert('loaded');}).create('json_data.html');
     * @constructs
     */
    initialize: function(name,settings) {
        this.id = name; //contain grid's id
        this.page = 0; //the current page
        this.options = $H({
            recs_per_page : 10, //how many records per page
            pages_cached : 1, //how many pages to cache everytime we go get data
            min_width : 100, //minimum header width, 0 for none
            theme: 'default', //grid theme
            onLoadFcn: Prototype.emptyFunction, //function to run after data has been loaded
            onCreateFcn: Prototype.emptyFunction, //function to run after grid has been fully created and data has been loaded
            page_selector : false //whether to show a dropdown with pages selector
        });
        this.data = $H(); //data cache
        this.header = $A(); //header
        this.total_recs = 0; //total amount of records
        this.url= ""; //url to get data from


        $H(settings || {}).each(function(s){
            if (this.options.keys().include(s.key)) { //if the setting provided is valid
                this.options.set(s.key,s.value);
            }
            else {
                alert('The setting provided \''+s.key+'\' is illegal');
            }
        }.bind(this));

        //add the current object to hash to be referenced back
        grids.set(name,this);
    },
    /**
     * Creates a grid based on a url.
     * @param {String} url URL that serves as the data source for the grid. Should be formated as JSON string
     * @return The grid object
     * @type ATMCASHGrid Object
     * @example
     * <b><u>JSON Format:</u></b>
     * <ul><li><b>header:</b> an array of labels that serve as headers. each label can be a hash where the key is label and value is width (optional)</li>
     * <li><b>data:</b> an array of hashes, every key is the label, every value is a hash that can contain the following elements:
     *  <ul><li><b>onclick:</b> onClick event function (optional)</li>
     *  <li><b>a:</b> encapsulates the data with a link, should also have a hash as its value with the following possible params: (optional)
     *      <ul><li><b>title:</b> the title of the link (optional)</li>
     *      <li><b>link:</b> the actual link [href]</li></ul></li>
     * </ul></li>
     * <li><b>total_recs:</b> the total amount of records fetched.</li></ul>
     *
     * <b>Example:</b><pre>{
    "header":
        [{"Address 1":170},"Address 2","Country"],
    "data":[
        { '432 Washington Blvd.':{'onclick':'alert("1")'},
            '#140':{'a':{'link':'ajax_test.html','title':'This is a test!!!'}},
            'United States':{'onclick':'link2'}},
        { '2000 Main st':{'onclick':'alert("2")'},
            '#140':{},
            'United States':{'onclick':'link2'}},
        { '2000 Main st':{'onclick':'alert("3")'},
            '#140':{},
            'United States':{'onclick':'link2'}},
        { '2000 Main st':{'onclick':'alert("4")'},
            '#140':{'a':'http://www.google.com'},
            'United States':{'onclick':'link2'}},
        { '2374 Ocean Ave':{'onclick':'alert("5")'},
            '':{},
            'United States':{'onclick':'link2'}}
    ],
    "total_recs": 5
}</pre>
     */
    create: function(url) {
        this.url = url;
        this._getData(this.page,true);
        return this;
    },
    /**
     * Helper Function: Generates grid skeleton and injects into page
     * @private
     *
     */
    _create: function() {
        //add classes
        $(this.id).addClassName('grid').addClassName(this.options.get('theme'));

        //if there is a header, populate it
        if (this.header.size()!==0) {
            var ul = new Element('ul',{
                'class':'header'
            });

            //insert header titles
            this.header.each(function(t){
                if (Object.isHash(t)) { //if we have a specific width provided for the header. (if less than minimum width, minimum width will kick in)
                    var tmparr = t.toArray();
                    ul.insert(new Element('li').update(tmparr.first().first()).setStyle({
                        'width':tmparr.first().last()+'px'
                    }));
                }
                else {
                    ul.insert(new Element('li').update(t));
                }
            });
            
            $(this.id).insert(((new Element('li')).insert(ul)).wrap((new Element('ul'))));

            //after we've displayed the titles, find the width of each and store in the hash
            this.header = $A();
            $(this.id).down('ul',1).immediateDescendants().each(function(t){
                t.setStyle({
                    'width':(this.options.get('min_width')!==0&&t.getWidth()<this.options.get('min_width')?this.options.get('min_width'):t.getWidth())+'px'
                });
                this.header.push(t.getWidth()-4);
            }.bind(this));
        } else {
            if (this.options.get('min_width')===0) {
                alert('You must have either min_width set or provide with headers');
                return;
            }
            $(this.id).insert((new Element('ul')));
        }

        //add footer
        $(this.id).insert({
            bottom:'<div class="footer"><div class="status" style="display:none"></div>'+(this.options.get('page_selector')?'<div class="selector"><select></select></div>':'')+'<div class="stats"></div> <img src="images/blank.gif" alt="First" class="first" onclick="Grids.getObject(\''+(this.id)+'\').first();return false;" /><img src="images/blank.gif" alt="Previous" class="prev" onclick="Grids.getObject(\''+(this.id)+'\').prev();return false;" /> <img src="images/blank.gif" alt="Next" class="next" onclick="Grids.getObject(\''+(this.id)+'\').next();return false;" /><img src="images/blank.gif" alt="Last" class="last" onclick="Grids.getObject(\''+(this.id)+'\').last();return false;" /></div>'
        });
        Event.observe($(this.id).down('.selector select'), 'change',function(e) {
            Event.stop(e);
            if (!$(this.id).down('div.status').visible()) {
                this._getData(parseInt($F(Event.element(e))),false);
            }
        }.bindAsEventListener(this));
    },
    /**
     * Helper Function: Writes the data into the grid.
     * @private
     */
    _populateData: function() {
        //remove all li's
        
        if (!Object.isUndefined($(this.id).down('ul'))) {
            $(this.id).down('ul').immediateDescendants().each(function(r){
                if (!r.down('ul').hasClassName('header')) {
                    r.remove();
                }
            });
        }
        
        //included records:
        var range = $R(this.page*this.options.get('recs_per_page'),(this.page+1)*this.options.get('recs_per_page')-1);

        var posted_recs = 0;
        
        //insert all the data based on the page
        this.data.each(function(r) {
            if (range.include(r.key)) { //if we should add this record, add it
                posted_recs++;
                var ul = new Element('ul');
                var field = 0;
                r.value.each(function(v) {
                    var li = new Element('li');
                    //if we have a link, create a link
                    if (v[1].keys().include('a')) {
                        if (Object.isHash(v[1].get('a'))) {
                            var ah = new Element('a',{
                                'href':v[1].get('a').get('link')
                            }).update(v[0]);
                            v[1].get('a').each(function(l){
                                if (l.key != 'link') { //we already placed the link in
                                    ah.writeAttribute(l.key,l.value);
                                }
                            });
                            li.insert(ah);
                        } else {
                            li.insert(new Element('a',{
                                'href':v[1].get('a')
                            }).update(v[0]));
                        }
                    }
                    else { //otherwise, update the li with the content
                        li.update(v[0]);
                    }
                    v[1].each(function(a){
                        if (a.key!='a') { //we already added A href, to don't add it as an attribute
                            li.writeAttribute(a.key,a.value);
                        }
                    });
                    ul.insert(((li.setStyle({
                        'width':((this.header.size()>field)?this.header[field]:this.options.get('min_width'))+'px'
                    }))));

                    field++;
                }.bind(this));

                $(this.id).down('ul').insert(((new Element('li')).insert(ul)));
            }
        }.bind(this));
        //update page stats
        $(this.id).down('div.stats').update(((this.page*this.options.get('recs_per_page')+1)+'-'+((posted_recs==this.options.get('recs_per_page'))?((this.page+1)*this.options.get('recs_per_page')):((this.page*this.options.get('recs_per_page'))+posted_recs)))+' / '+this.total_recs);
        if (this.options.get('page_selector')) {
            var select = $(this.id).down('.selector select');
            //clear all options
            select.update();
            for (var i=1;i<=((this.total_recs/this.options.get('recs_per_page')).ceil());i++) {
                if ((i-1) == this.page) {
                    select.insert(new Element('option', {value: i-1, selected:'selected'}).update(i));
                } else {
                    select.insert(new Element('option', {value: i-1}).update(i));
                }
            }
        }
        //update navigation links
        if (this._can_next()) {
            $(this.id).down('.next').removeClassName('gray');
            $(this.id).down('.last').removeClassName('gray');
        }
        else {
            $(this.id).down('.next').addClassName('gray');
            $(this.id).down('.last').addClassName('gray');
        }
        if (this._can_prev()) {
            $(this.id).down('.prev').removeClassName('gray');
            $(this.id).down('.first').removeClassName('gray');
        }
        else {
            $(this.id).down('.prev').addClassName('gray');
            $(this.id).down('.first').addClassName('gray');
        }

        //once the data has been loaded, call onLoadFunction
        this.options.get('onLoadFcn')($(this.id));
    },
    /**
     * Helper Function: Gets 'recs_per_page'*'pages_cached' records from the url.
     * @param {Int} page The page number
     * @param {Boolean} creation Indicates whether we should create the grid or only load the data
     * @private
     */
    _getData: function(page,creation) {
        //decide whether to go fetch data or is it already cached
        var max_rec = ((page+this.options.get('pages_cached')+1)*this.options.get('recs_per_page'));
        var range_of_pages_to_fetch = $R(page*this.options.get('recs_per_page'),((max_rec>this.total_recs&&this.total_recs!==0)?this.total_recs:max_rec)-1);
        var pages_not_cached = $A();
        range_of_pages_to_fetch.each(function(r){
            if (!this.data.keys().include(r)) {
                pages_not_cached.push(r);
            }
        }.bind(this));
        if (page == this.page) { //if it is a force reload
            $R(page*this.options.get('recs_per_page'),((page+1)*this.options.get('recs_per_page'))-1).each(function(r){
                pages_not_cached.push(r);
                this.data.unset(r);
            }.bind(this));
        }
        //eliminate duplications
        pages_not_cached = pages_not_cached.uniq();
        //go fetch information, there are records that are not cached yet
        if(pages_not_cached.size()>0) {

            //check if the current page's data is cached
            //and we have a case where the buffer isn't cached yet but the actual page is.
            var alreadyPopulated = false;
            if ((page+1)*this.options.get('recs_per_page')-1 < pages_not_cached.min()) {
                this.page = page;

                this._populateData();
                alreadyPopulated = true;
            }


            (new Ajax.Request(this.url, {
                parameters:{
                    'start_rec':pages_not_cached.min(),
                    'end_rec':pages_not_cached.size()
                },
                onCreate: function() {
                    if (!Object.isUndefined($(this.id).down('div.status'))) {
                        $(this.id).down('div.status').show();
                    }
                }.bind(this),
                onSuccess: function(response) {
                    this.page = page;
                    var data = $H(this._jsonToHash(eval('('+response.responseText+')')));
                    //adding data to cache
                    //var rec_id = (this.page*this.options.get('recs_per_page'));
                    var rec_id = pages_not_cached.min();
                    //if the total_recs is different than what we currently have, clear the cache
                    //if (data.get('total_recs') < this.total_recs) {
                    //    this.data = $H();
                    //}
                    data.get('data').each(function(r){
                        if (!this.data.keys().include(rec_id)) {
                            this.data.set(rec_id,r);
                        }
                        rec_id++;
                    }.bind(this));
                    
                    if (this.header.size() === 0 && data.keys().include('header')) {
                        this.header = data.get('header');
                    }
                    
                    this.total_recs = data.get('total_recs');
                
                    if (creation) {
                        this._create();
                    }
                    
                    $(this.id).down('div.status').hide();
                    //populate data
                    if (!alreadyPopulated) {
                        this._populateData();
                    }
                    if (creation) {
                        //once the grid has been created, call onCreateFunction
                        this.options.get('onCreateFcn')($(this.id));
                    }
                }.bind(this)
            }));
        } else {
            this.page = page;
            this._populateData();
        }
    },
    /**
     * Setter: sets a function to be called every time a new grid page has finished loading.
     * @param {Function} fnc Function object that would be called onLoad event.
     * @return The grid object
     * @type ATMCASHGrid Object
     */
    onLoad: function(fnc){
        if (fnc!==null && Object.isFunction(fnc)) {
            this.options.set('onLoadFcn',fnc);
        }
        return this;
    },
    /**
     * Setter: sets a function to be called when the Grid has been created and data finished loading
     * @param {Function} fnc Function object that would be called onCreate event.
     * @return The grid object
     * @type ATMCASHGrid Object
     */
    onCreate: function(fnc){
        if (fnc!==null && Object.isFunction(fnc)) {
            this.options.set('onCreateFcn',fnc);
        }
        return this;
    },
    /**
     * Loads the last page.
     */
    last: function() {
        if (this._can_next()) {
            this._getData((this.total_recs/this.options.get('recs_per_page')).ceil()-1,false);
        }
    },
    /**
     * Loads the first page.
     */
    first: function() {
        if (this._can_prev()) {
            this._getData(0,false);
        }
    },
    /**
     * Loads the next page
     */
    next: function() {
        if (this._can_next()) {
            this._getData(this.page+1,false);
        }
    },
    /**
     * Loads the previous page
     */
    prev: function() {
        if (this._can_prev()) {
            this._getData(this.page-1,false);
        }
    },
    /**
     * Helper Function: Checks whether we can go to a next page or not.
     * @return True or False, True if we can go next, False otherwise.
     * @type Boolean
     * @private
     */
    _can_next: function() {
        return !$(this.id).down('div.status').visible()&&(this.page < (this.total_recs/this.options.get('recs_per_page')).ceil()-1);
    },
    /**
     * Helper Function: Checks whether we can go to a previous page or not.
     * @return True or False, True if we can go previously, False otherwise.
     * @type Boolean
     * @private
     */
    _can_prev: function() {
        return !$(this.id).down('div.status').visible()&&(this.page > 0);
    },
    /**
     * Helper Function: Reloads the current page (disregarding cache)
     */
    _reload: function() {
        this._getData(this.page,false);
    },
    /**
     * Helper Function: Turns json into nested hash
     * @param {JSON} json JSON Object
     * @return Hashed version of the JSON
     * @type JSON
     * @private
     */
    _jsonToHash: function(json) {
        for(var prop in json) {
            if(json.hasOwnProperty(prop)) {
                if (Object.isArray(json[prop])) {
                    json[prop] = $A(this._jsonToHash(json[prop]));
                } else if (!Object.isString(json[prop]) && !Object.isNumber(json[prop])) {
                    json[prop] = $H(this._jsonToHash(json[prop]));
                }
            }
        }
        return json;
    }
});

/**
* This is a getter function for created ATMCASHGrid object
* @addon
* @param {String} name The grid's container id, also used to create the grid.
* @return a grid object
* @type ATMCASHGrid Object
*/
Grids.getObject = function(name) {
    return grids.get(name);
};
/**
* This function forces a reload on the current page.
* @addon
* @param {String} name The grid's container id, also used to create the grid.
*/
Grids.reload = function(name) {
    Grids.getObject(name)._reload();
};