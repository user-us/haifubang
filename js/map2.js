/**
 * Created by JiangXiaolong on 2017/3/20.
 * Copyright 2017 我爱我家 All rights reserved.
 * 我爱我家地图找房业务逻辑处理方法集合
 */
"use strict";
//地图搜索模式
var LOCATIONSEARCH = 1;//区域找房
var SUBWAYSEARCH = 2;//地铁找房
var COMMUTESEARCH = 3;//通勤找房
//房源类型
var TYPE_SALE = 1;//二手房
var RENT = 2;//租房
//地图缩放级别level显示区域类型
var LEVEL_CITY = 2;//城市
var LEVEL_DISTRICT = 3;//行政区
var LEVEL_BUSINESS_AREA = 4;//商圈
var LEVEL_COMMUNITY = 5;//小区
var LEVEL_SUBWAY_LINE = 6;//地铁线
var LEVEL_SUBWAY_STATION = 7;//地铁站

var ZOOM_DISTRICT = 12;
var ZOOM_BUSINESSAREA = 14;
var ZOOM_COMMUNITY = 16;
var COOKIEKEY='map_cookiekey';
//通勤方式
var ONFOOT = 1;//步行
var DRIVE = 2;//地铁站
//通勤时间
var QUARTER = 1;//15分钟
var HALFHOUR = 2;//半小时
var HOUR = 3;//1小时
//服务器地址
var MAP_API_URL = '/map/ajax/';
var HOUSEIMAGE404 = resHostUrl + '/pc/common/images/houseList404.jpg';
/**
 * 地图搜索条件
 **/

WjMap.prototype.listenEvent = false;
WjMap.prototype.communityElementList = {};
WjMap.prototype.searchCondition = {
    updateMode: LOCATIONSEARCH,//搜索模式 map地图 subway地铁 commute通勤
    houseType: TYPE_SALE,//房源类型 1二手房 2租房
    onMove: false,//移动地图时搜索 默认关闭

    boundsLevel: LEVEL_DISTRICT,
    locationLevel: LEVEL_CITY,
    locationId: null,  //点击区域的id
    locationCoord: null,

    subwayStation: null,//地铁线id
    subwayLine: null,//地铁线id

    transport: 1,//1步行 2自驾 通勤时间
    commuteTime: 1,//通勤时间
    landMark: {},

    page: 1,
    pageSize: 20,
    lastPage: true,
    listApiUrl: '',

    //通用条件
    salePrices: 0,//price 二手房价格
    rentPrices: 0,//price 二手房价格
    room: [],//楼层
    floor: [],//楼层
    heading: [],//朝向
    buildAges: 0,//建筑年限
    buildArea: 0,//建筑面积
    decoration: [],//装修
    saleTags: [],//tag 买房标签
    rentTags: [],//tag 租房标签
    order: [],//order 0默认 价格排序 3低到高 4高到低 按时间 7近到远 8远到近

    rentBrand: [],//租房品牌
    rentType:[]//租房类型 整租合租
};
/**
 * 地图搜索条件处理
 **/
/*整理地图找房附加查询条件*/
WjMap.prototype.getExtrasCondition = function () {
    var conditions = '';

    conditions += this.searchCondition.order != 0 ? 'o' + this.searchCondition.order : '';
    conditions += this.searchCondition.buildArea != 0 ? 'a' + this.searchCondition.buildArea : '';
    conditions += this.searchCondition.buildAges != 0 ? 'y' + this.searchCondition.buildAges : '';

    if (this.searchCondition.houseType == TYPE_SALE) {
        conditions += this.searchCondition.salePrices != 0 ? 'p' + this.searchCondition.salePrices : '';
        conditions += formString(this.searchCondition.saleTags,'t');
    } else {
        conditions += this.searchCondition.rentPrices != 0 ? 'p' + this.searchCondition.rentPrices : '';
        conditions += formString(this.searchCondition.rentTags,'t');
    }

    conditions += formString(this.searchCondition.room,'r');
    conditions += formString(this.searchCondition.heading,'f');
    conditions += formString(this.searchCondition.floor,'c');
    conditions += formString(this.searchCondition.decoration,'z');
    conditions += formString(this.searchCondition.rentBrand,'w');
    conditions += formString(this.searchCondition.rentType,'u');

    return conditions;

    function formString(condition,str){
        var temp = '';
        if(!condition){
            return temp;
        }
        condition.sort();
        for(var i in condition){
            temp += str+condition[i];
        }
        return temp;
    }
};
//整合找房条件 输出查询请求url
WjMap.prototype.getRequestUrl = function (updateList) {
    var self = this;
    var requestUrl = '';
    var param = {};
    param.onMove = updateList ? false : self.searchCondition.onMove;
    switch (self.searchCondition.updateMode) {
        case LOCATIONSEARCH:
            requestUrl = 'location';
            if (updateList) {
                param.locationId = self.searchCondition.locationId;
                param.locationLevel = self.searchCondition.locationLevel;
            }
            break;
        case COMMUTESEARCH:
            requestUrl = 'commute';
            if (updateList) {
                param.locationId = self.searchCondition.locationId;
                param.locationLevel = self.searchCondition.locationLevel;
            }
            param.commuteTime = self.searchCondition.commuteTime;
            param.transport = self.searchCondition.transport;
            param.landMark = JSON.stringify({
                lng: self.searchCondition.landMark.lng,
                lat: self.searchCondition.landMark.lat
            });
            break;
        default :
            console.log(self.searchCondition.updateMode);
            return false;
    }
    param.bounds = JSON.stringify(self.getMapCoord('bounds'));
    param.boundsLevel = self.searchCondition.boundsLevel;
    param.pageSize = self.searchCondition.pageSize;
    requestUrl += self.searchCondition.houseType == TYPE_SALE ? '/sale' : '/rent';
    var extras = self.getExtrasCondition();
    if (extras) {
        requestUrl += '/' + extras;
    }
    requestUrl += '?' + http_build_query(param);
    self.searchCondition.listApiUrl = requestUrl;
    if (updateList || param.onMove) {
        self.searchCondition.page = 1;
        requestUrl += '&page=1';
    } else {
        requestUrl += '&page=0';
    }

    return requestUrl;
};
/**
 * 地图刷新方法start
 **/
/*
 * 更新区域找房地图
 */
WjMap.prototype.updateLocationMap = function (locationLevel, locationId) {
    var self = this;
    var updateList = true;
    if (locationLevel && locationId) {
        if (locationLevel == LEVEL_DISTRICT && locationId == 0) {
            locationLevel = LEVEL_CITY;
            locationId = city.id;
        }
        self.searchCondition.locationLevel = locationLevel;
        self.searchCondition.locationId = locationId;
    } else {
        updateList = false;
    }
    var request = self.getRequestUrl(updateList);
    self.listenEvent = false;//避免多次重复提交请求
    self.getAjaxData(MAP_API_URL, request, function (callback) {
        if (callback.code != '200') {
            if (self.config.debugOn&&callback.message) {
                console.log(callback.message)
            }
            setTimeout(function () {
                self.listenEvent = true;
            }, 300);
            return false;
        }
        var houseType = callback.data.res.houseType;
        var map = callback.data.res.map;
        var level = callback.data.res.level;
        var houses = callback.data.res.houses;
        var page = callback.data.res.page;
        var pageSize = callback.data.res.pageSize;
        if (map) {
            if (level == LEVEL_COMMUNITY) {
                self.setCommunityElement(houseType, map);
            } else {
                self.setLocationElement(houseType, map, level);
            }
        }
        if (page) {
            self.updateHouseList(houseType, houses, page,pageSize);
        }
        if(callback.data.res.market.length!=0){
            var market = callback.data.res.market;
            var domLocationPrice = $('#mapLocation>.junjia');
            domLocationPrice.children('span').html(Math.ceil(market.prelistedavgprice));
            if(market.prelistedavgprice && self.searchCondition.houseType==TYPE_SALE) {
                $('#mapLocation').show().children('p.dangqian').children('span').html(market.areaname);
                domLocationPrice.show();
            }else{
                domLocationPrice.hide();
            }
        }
        setTimeout(function () {
            self.listenEvent = true;
        }, 300);
    });
};
/*
 * 更新地铁找房地图
 */
WjMap.prototype.updateSubwayMap = function (locationLevel, locationId) {
    var self = this;
    var updateList = true;
    var param = {};

    if (locationId && locationLevel) {
        if (locationLevel == LEVEL_SUBWAY_STATION) {
            var lineid=getSubwayLineByStation(locationId);
            param.lineid = self.searchCondition.subwayLineid = lineid;//地铁线的lineid
            param.line = self.searchCondition.subwayLine = self.mapData.subwayLine[lineid].id;//地铁线的id
            param.station = self.searchCondition.subwayStation = locationId;//地铁站的id
            self.searchCondition.landMark = self.mapData.subwayLine[lineid]['stations'][locationId];

        } else if (locationLevel == LEVEL_SUBWAY_LINE) {
            param.lineid = self.searchCondition.subwayLineid  = locationId;
            param.line = self.searchCondition.subwayLine = self.mapData.subwayLine[locationId].id;
            self.searchCondition.subwayStation = null;
            self.searchCondition.landMark = null;
        } else {
            param.lineid = self.searchCondition.subwayLineid;
            param.line = self.searchCondition.subwayLine;
            if (self.searchCondition.subwayStation) {
                param.station = self.searchCondition.subwayStation;
            }
        }
        param.locationLevel = self.searchCondition.locationLevel = locationLevel;
        param.locationId = self.searchCondition.locationId = locationId;
    } else {
        param.locationLevel = self.searchCondition.locationLevel;
        param.locationId = self.searchCondition.locationId;
        param.line = self.searchCondition.subwayLine;
        param.lineid = self.searchCondition.subwayLineid;
        if (self.searchCondition.subwayStation) {
            param.station = self.searchCondition.subwayStation;
        }
        updateList = false;
    }
    var request = 'subway';

    if (!updateList) {
        param.onMove = self.searchCondition.onMove;
    }
    param.boundsLevel = self.searchCondition.boundsLevel;
    param.bounds = JSON.stringify(self.getMapCoord('bounds'));
    param.pageSize = self.searchCondition.pageSize;
    request += self.searchCondition.houseType == TYPE_SALE ? '/sale' : '/rent';
    var extras = self.getExtrasCondition();
    if (extras) {
        request += '/' + extras;
    }
    request += '?' + http_build_query(param);
    self.searchCondition.listApiUrl = request;
    if (updateList || param.onMove) {
        self.searchCondition.page = 1;
        request += '&page=1';
    } else {
        request += '&page=0';
    }

    //开始请求数据
    self.listenEvent = false;
    self.getAjaxData(MAP_API_URL, request, function (callback) {
        if (callback.code != '200') {
            if (self.config.debugOn&&callback.message) {
                console.log(callback.message)
            }
            setTimeout(function () {
                self.listenEvent = true;
            }, 300);
            return false;
        }
        var houseType = callback.data.res.houseType;
        var level = callback.data.res.level;
        var subway = callback.data.res.subway;
        var community = callback.data.res.community;
        var houses = callback.data.res.houses;
        var page = callback.data.res.page;
        var pageSize = callback.data.res.pageSize;
        if (community.length) {
            if (level == LEVEL_COMMUNITY) {
                self.setCommunityElement(houseType, community);
            }
        } else {
            self.map.clearOverlays();
        }

        if (subway.station) {
            wiwjMap.searchCondition.subwayStation = subway.station;
            self.setSubwayElement(subway);
        } else {
            subway.station = wiwjMap.searchCondition.subwayStation;
            self.setSubwayElement(subway);
        }
        if (page) {
            self.updateHouseList(houseType, houses, page,pageSize);
        }

        if(callback.data.res.market.length!=0){
            var market = callback.data.res.market;
            var domLocationPrice = $('#subwayLocation>.junjia');
            domLocationPrice.children('span').html(Math.ceil(market.prelistedavgprice));
            if(market.prelistedavgprice && self.searchCondition.houseType==TYPE_SALE) {
                $('#subwayLocation').show().children('p.dangqian').children('span').html(market.areaname);
                domLocationPrice.show();
            }else{
                domLocationPrice.hide();
            }
        }

        setTimeout(function () {
            self.listenEvent = true;
        }, 300);
    });
};
/*
 * 更新通勤找房地图
 */
WjMap.prototype.updateCommuteMap = function (locationLevel, locationId) {
    var self = this;
    if (!self.searchCondition.landMark||!self.searchCondition.landMark.name) {
        return false;
    }
    var updateList = true;
    self.listenEvent = false;

    if (locationLevel && locationId) {
        switch(locationLevel){
            case LEVEL_DISTRICT:
                locationLevel = LEVEL_CITY;
                locationId = city.id;
            case LEVEL_CITY:
                var zoom = ZOOM_COMMUNITY;
                //if(self.searchCondition.transport == 1){
                //    zoom = ZOOM_COMMUNITY-Math.floor(self.searchCondition.commuteTime/3);
                //}else{
                //    zoom = ZOOM_COMMUNITY-Math.floor(self.searchCondition.commuteTime*1.5);
                //}
                wiwjMap.map.centerAndZoom(new BMap.Point(self.searchCondition.landMark.lng,self.searchCondition.landMark.lat),zoom);
                break;
        }

        self.searchCondition.locationLevel = locationLevel;
        self.searchCondition.locationId = locationId;
    } else {
        updateList = false;
    }

    var request = self.getRequestUrl(updateList);

    self.getAjaxData(MAP_API_URL, request, function (callback) {
        if (callback.code != '200') {
            if (self.config.debugOn&&callback.message) {
                console.log(callback.message)
            }
            setTimeout(function () {
                self.listenEvent = true;
            }, 300);
            return false;
        }
        var houseType = callback.data.res.houseType;
        var map = callback.data.res.map;
        var level = callback.data.res.level;
        var houses = callback.data.res.houses;
        var range = callback.data.res.range;
        var page = callback.data.res.page;
        var pageSize = callback.data.res.pageSize;
        if (map) {
            if (level == LEVEL_COMMUNITY) {
                self.setCommunityElement(houseType, map);
                self.setLandMarkElement(range);
            } else {
                self.setLocationElement(houseType, map, level);
                self.setLandMarkElement(range);
            }
            if (map.range) {
                var point = new BMap.Point(self.searchCondition.landMark.lng, self.searchCondition.landMark.lat);
                self.setRangeElement(point, map.range);
            }
        }
        if (page) {
            self.updateHouseList(houseType, houses, page,pageSize);
        }
        if(callback.data.res.market.length!=0){
            var market = callback.data.res.market;
            var domLocationPrice = $('#commuteLocation>.junjia');
            domLocationPrice.children('span').html(Math.ceil(market.prelistedavgprice));
            if(market.prelistedavgprice && self.searchCondition.houseType==TYPE_SALE) {
                $('#commuteLocation').show().children('p.dangqian').children('span').html(market.areaname);
                domLocationPrice.show();
            }else{
                domLocationPrice.hide();
            }
        }
        setTimeout(function () {
            self.listenEvent = true;
        }, 300);
    });
};
/**
 * 地图刷新方法end
 **/
/**
 * 房源列表刷新方法start
 **/
//根据房源数据 更新房源列表
WjMap.prototype.updateHouseList = function (houseType, houses, page,pageSize) {
    var self = this;
    var listBody = document.getElementById('houseList');//设置列表dom对象

    self.searchCondition.lastPage = true;
    if (houses.count && page && pageSize) {
        if (houses.count >= page * pageSize) {
            self.searchCondition.lastPage = false;
        }
    }

    if (page == 1) {
        //如果列表页数为1则清空列表 重新插入数据
        listBody.innerHTML = '';
        listBody.style.top = 0;
        if (houses.length == 0 || houses.count == 0) {
            //如果页数为1 且无找到房源 显示没有找到房源和兔子图标
            $('.houseOrder').hide();
            listBody.innerHTML = '<li class="no-list">没有找到相关的房源</li>';
            return false;
        } else {
            $('.houseOrder').show();
            $('.total').show().children('em').text(houses.count);
        }
    } else {
        var listNode = listBody.getElementsByTagName('li');
        var listHint = listNode[listNode.length - 1];
        listBody.removeChild(listHint);
        if (!this.searchCondition.lastPage) {
            $('.total').show().children('em').text(houses.count);
        }
    }
    //设置房源类型
    var houseUrl = houseType == TYPE_SALE ? '/ershoufang/' : '/zufang/';
    for (var id in houses.list) {
        try {
            var house = houses.list[id];
            var li = document.createElement('li');
            var liA = document.createElement('a');
            liA.href = houseUrl + house.id + '.html';
            var img = '<div class="pic fl"><img src="';
            if(!house.img_url){
                img+= HOUSEIMAGE404;
            }else{
                img+= house.img_url;
            }
            img+='" alt="">';
            liA.innerHTML = img;
            liA.target="_blank";
//          li.innerHTML = img;

            li.setAttribute('data-community',house.community_id);

            var div = document.createElement('div');
            var districtName = house.district_name ? house.district_name + ' ' : '';
            var businessAreaName = house.business_area_name ? house.business_area_name : '';

            div.setAttribute('class', 'info fr');
            var title = '<h3>' + house.community_name + '</h3>';
            var location = '<p class="wz"><span class="dw">' + districtName + ' ' + businessAreaName + '</span></p>';
            var room = '<p class="wz">';
            room += (house.bedroom && house.livingroom) ? house.bedroom + '室' + house.livingroom + '厅' : '';
            room += (house.buildarea) ? '&nbsp;&middot;&nbsp;' + house.buildarea + '平米' : '';
            room += (house.heading) ? '&nbsp;&middot;&nbsp;' + house.heading : '';
            room += '</p>';
            var tag = '<p class="label">';
            if (house.tagwall) {
                if (house.tagwall[0]) {
                    tag += '<span>' + house.tagwall[0] + '</span>';
                }
                if (house.tagwall[1]) {
                    tag += '<span>' + house.tagwall[1] + '</span>';
                }
                if (house.tagwall[2]) {
                    tag += '<span>' + house.tagwall[2] + '</span>';
                }
            }

            tag += '</p>';
            if (houseType == TYPE_SALE) {
                var price = '<p class="price"><span class="num"><em>' + house.price + '</em>万</span>';
                if(null != house['unit_price']) {
                    price +='<span class="pingmi">' + house['unit_price'] + '元/平</span></p>';
                }
            } else {
                var price = '<p class="price"><span class="num"><em>' + house.price + '</em>元/月</span></p>';
            }

            div.innerHTML = title + location + room + tag + price;
            liA.appendChild(div);
            li.appendChild(liA);
            listBody.appendChild(li);
        } catch (e) {
            //console.log(e);
            continue;
        }
    }

    if (!self.searchCondition.lastPage) {
        listHint = document.createElement('li');
        listHint.style['text-align'] = 'center';
        listHint.innerHTML = '<a class="nextPage" style="text-align:center">房源加载中...</a>';
        listBody.appendChild(listHint);
    } else if(self.searchCondition.lastPage && page!=1) {
        listHint = document.createElement('li');
        listHint.style['text-align'] = 'center';
        listHint.innerHTML = '<a class="lastPage" style="text-align: center">到底喽</a>';
        //listBody.appendChild(listHint);
    }
    var marker = {};
    var communityid = null;
    $(listBody).children('li').hover(function(){
        communityid = $(this).data('community');
        if(communityid in self.communityElementList){
            marker = self.communityElementList[communityid];
            if(!marker.highLight){
                marker.setHighLight(50000);
                marker.mouseover = true;
            }
        }
    },function(){
        communityid = $(this).data('community');
        if(communityid in self.communityElementList && marker && !marker.highLight){
            marker.setLowLight();
            marker.mouseover = false;
        }
    });
};

//读取房源列表下一页数据
WjMap.prototype.loadNextPage = function () {
    if (this.listenEvent == false) {
        return false;
    }
    if (this.searchCondition.lastPage) {
        return false;
    }
    var self = this;
    var apiData = this.searchCondition.listApiUrl + '&page=' + (++self.searchCondition.page);
    self.listenEvent = false;
    self.getAjaxData(MAP_API_URL, apiData, function (callback) {
        if (callback.code != '200') {
            if (self.config.debugOn&&callback.message) {
                console.log(callback.message)
            }
            setTimeout(function () {
                self.listenEvent = true;
            }, 300);
            return false;
        }
        var houses = callback.data.res.houses;
        var page = callback.data.res.page;
        var pageSize = callback.data.res.pageSize;
        if (page) {
            self.updateHouseList(self.searchCondition.houseType, houses, page,pageSize);
        }
        setTimeout(function () {
            self.listenEvent = true;
        }, 300);
    });
};
/**
 * 房源列表刷新方法end
 **/
/**
 * 地图标注覆盖物方法start
 **/
//显示区域、商圈覆盖物  self.setLandMarkElement();
WjMap.prototype.setLocationElement = function (houseType, locations, level) {
    var self = this;
    var highLight;
    self.map.clearOverlays();
    self.setSurroundElement();
    for (var id in locations) {
        if(locations[id]['name']=='北京其他'||locations[id]['name']=='北京周边'){
            continue;
        }
        highLight=(self.searchCondition.locationId==locations[id].id && self.searchCondition.locationLevel==level)?true:false;
        var location = new self.poly.location(locations[id], {
            highLight:highLight,
            mode: self.searchCondition.houseType == RENT ? 'rent' : 'sale',
            onClick: function (marker) {
                marker.addEventListener('click', function () {
                    wiwjMap.clickLocationElement(level, marker.id, marker.point);//不是按区域搜索 按点击对象更新列表
                });
            },
            onMouseover: function (marker) {
                self.mouseOverLocationElement(marker, level)
            }
        });
        self.map.addOverlay(location);
    }
};
//显示小区覆盖物
WjMap.prototype.setCommunityElement = function (houseType, communitys) {
    var self = this;
    var highLight;
    self.map.clearOverlays();
    self.setSurroundElement();
    self.communityElementList={};
    for (var id in communitys) {
        highLight=(self.searchCondition.locationId==communitys[id].id && self.searchCondition.locationLevel==LEVEL_COMMUNITY)?true:false;
        var community = new self.poly.community(communitys[id], {
            highLight:highLight,
            mode: self.searchCondition.houseType == RENT ? 'rent' : 'sale',
            onClick: function (marker) {
                marker.getLabel().addEventListener('click', function () {
                    wiwjMap.clickLocationElement(LEVEL_COMMUNITY, marker.id, marker.point);//不是按区域搜索 按点击对象更新列表
                });
            },
            onMouseover: function (marker) {
                self.mouseOverLocationElement(marker, LEVEL_COMMUNITY);
            }
        });
        self.communityElementList[communitys[id].id]=community;
        self.map.addOverlay(community);
    }
};
//显示地铁覆盖物
WjMap.prototype.setSubwayElement = function (data) {
    var self = this;
    var lineId;
    var targetStation;
    var stationList;
    if (data) {
        lineId = data.lineid || self.searchCondition.subwayLineid;
        targetStation = data.station || self.searchCondition.subwayStation;
        stationList = data.stationList || [];
    } else {
        lineId = self.searchCondition.subwayLineid;
        targetStation = self.searchCondition.subwayStation;
        stationList = [];
    }

    //地铁站覆盖物
    var stations = self.mapData.subwayLine[lineId]['stations'];
    var id;
    for (id in stations) {
        var station = stations[id];
        if (stationList && stationList[id]) {
            station['price'] = stationList[id]['price'] ? stationList[id]['price'] : '';
            station['count'] = stationList[id]['count'] ? stationList[id]['count'] : '';
        } else {
            station['price'] = station['count'] = '';
        }
        var location;
        if (id == targetStation) {
            location = new self.poly.subwayStation(station, {
                onClick: function (marker) {
                    marker.addEventListener('click', function () {
                        $(".curr-xian>span").html(marker.name);
                        wiwjMap.clickLocationElement(LEVEL_SUBWAY_STATION, marker.id, marker.point);//不是按区域搜索 按点击对象更新列表
                    });
                }
            });
        } else {
            location = new self.poly.location(station, {
                onClick: function (marker) {
                    marker.addEventListener('click', function () {
                        $(".curr-xian>span").html(marker.name);
                        wiwjMap.clickLocationElement(LEVEL_SUBWAY_STATION, marker.id, marker.point);//不是按区域搜索 按点击对象更新列表
                    });
                }
            });
        }
        self.map.addOverlay(location);
    }
    //地铁线覆盖物
    var lineName = self.mapData.subwayLine[lineId]['name'];
    if (subwayLineBight[lineName]) {
        var subwayLinePoly = self.poly.line(subwayLineBight[lineName]);
        self.map.addOverlay(subwayLinePoly);
    }
};
//通勤找房 显示目的地覆盖物
WjMap.prototype.setLandMarkElement = function (range) {
    var self = this;
    self.map.removeOverlay(self.searchCondition.landMark.range);
    self.map.removeOverlay(self.searchCondition.landMark.element);
    self.map.removeOverlay(self.searchCondition.landMark.support);

    self.searchCondition.landMark.point = new BMap.Point(self.searchCondition.landMark.lng, self.searchCondition.landMark.lat);
    self.searchCondition.landMark.element = new self.poly.landMark({
        name: self.searchCondition.landMark.name,
        point: self.searchCondition.landMark.point
    }, {
        onClick: function (marker) {
            marker.addEventListener('click', function () {
                $('#commuteLocation').hide();
                wiwjMap.clickLocationElement('', '', marker.point);//不是按区域搜索 按点击对象更新列表
            });
        }
    });
    if (range) {
        self.searchCondition.landMark.range = new self.poly.circle({
            point: self.searchCondition.landMark.point,
            range: range
        });
        self.map.addOverlay(self.searchCondition.landMark.range);
    }
    self.map.addOverlay(self.searchCondition.landMark.element);
};

//区域鼠标覆盖事件处理
WjMap.prototype.mouseOverLocationElement = function (marker, level) {
    var self = this;
    if (level == LEVEL_DISTRICT) {
        marker.bounds = null;
        marker.addEventListener('mouseover', function () {
            if (!marker.bounds && (marker.name in districtBound)) {
                marker.bounds = new self.poly.border(districtBound[marker.name]);
            }
            self.map.addOverlay(marker.bounds);
        });
        marker.addEventListener('mouseout', function () {
            self.map.removeOverlay(marker.bounds);
        });
    } else {
        if (level == LEVEL_COMMUNITY) {
            if (self.searchCondition.updateMode == COMMUTESEARCH || self.searchCondition.updateMode == SUBWAYSEARCH) {
                if (self.searchCondition.landMark == null) {
                    return false;
                }
                var label = marker.getLabel();
                var point = new BMap.Point(self.searchCondition.landMark.lng, self.searchCondition.landMark.lat);
                var link = new BMap.Polyline([point, marker.point], {
                    strokeColor: "rgba(231,64,87,0.9)",
                    strokeWeight: 2,
                    strokeOpacity: 0.8
                });
                label.addEventListener('mouseover', function () {
                    marker.setHighLight();
                    self.map.addOverlay(link);
                });
                label.addEventListener('mouseout', function () {
                    marker.setLowLight();
                    self.map.removeOverlay(link);
                });
            }
        }
    }
};
//区域点击事件处理
WjMap.prototype.clickLocationElement = function (locationLevel, locationId, LocationCoord) {
    this.listenEvent = false;
    switch (locationLevel) {
        case LEVEL_CITY:
            this.map.centerAndZoom(LocationCoord, ZOOM_DISTRICT);
            break;
        case LEVEL_DISTRICT:
            this.map.centerAndZoom(LocationCoord, ZOOM_DISTRICT + 2);
            break;
        case LEVEL_BUSINESS_AREA:
            this.map.centerAndZoom(LocationCoord, ZOOM_BUSINESSAREA + 2);
            break;
        case LEVEL_COMMUNITY:
            this.map.centerAndZoom(LocationCoord, ZOOM_COMMUNITY);
            break;
        case LEVEL_SUBWAY_STATION:
            this.map.centerAndZoom(LocationCoord, ZOOM_COMMUNITY);
            break;
        case LEVEL_SUBWAY_LINE:
            this.map.centerAndZoom(LocationCoord, ZOOM_DISTRICT);
            break;
        default :
            this.map.centerAndZoom(LocationCoord, ZOOM_COMMUNITY);
    }
    this.searchCondition.locationCoord=LocationCoord||new BMap.Point(city.lng,city.lat);
    switch (this.searchCondition.updateMode) {
        case LOCATIONSEARCH:
            this.updateLocationMap(locationLevel, locationId);
            break;
        case SUBWAYSEARCH:
            this.updateSubwayMap(locationLevel, locationId);
            break;
        case COMMUTESEARCH:
            if (locationId) {
                this.updateCommuteMap(locationLevel, locationId);
            } else {
                this.updateCommuteMap();
            }
            break;
    }
};
/**
 * 地图标注覆盖物方法end
 **/

/**
 * 页面dom监听方法与显示效果
 **/
//移动事件注册 (鼠标移动地图的时候  触发这个函数)
WjMap.prototype.mapMoveEvent = function (e) {
    var zoom = this.map.getZoom();
    if (zoom < ZOOM_BUSINESSAREA) {
        this.searchCondition.boundsLevel = LEVEL_DISTRICT;
    } else if (zoom < ZOOM_COMMUNITY) {
        this.searchCondition.boundsLevel = LEVEL_BUSINESS_AREA;
    } else {
        this.searchCondition.boundsLevel = LEVEL_COMMUNITY;
    }
    if (!this.listenEvent) {
        return false;
    }
    switch (this.searchCondition.updateMode) {
        case LOCATIONSEARCH:
            if (this.searchCondition.onMove) {
                $('#mapLocation').show().children('p.dangqian').children('span').html(city.name);
                if(this.searchCondition.houseType==TYPE_SALE){
                    $('#mapLocation>.junjia').children('span').html(Math.ceil(city.price)).show();
                }

            }
            this.updateLocationMap();//不是移动时搜索 不更新列表
            break;
        case SUBWAYSEARCH:
            if (zoom >= ZOOM_COMMUNITY) {
                $('#subwayLocation').hide();
                $('#subwayLocation>.junjia').hide();
                this.updateSubwayMap();
            } else {
                this.map.clearOverlays();
                this.setSubwayElement();
            }
            break;
        case COMMUTESEARCH:
            if (this.searchCondition.onMove) {
                $('#commuteLocation').hide();
                $('#commuteLocation>.junjia').hide();
            }
            this.updateCommuteMap();
            break;
    }
};
//缩放事件注册
WjMap.prototype.mapZoomEvent = function (e) {
    //刷新地图元素数据
    var zoom = this.map.getZoom();
    if (zoom < ZOOM_BUSINESSAREA) {
        this.searchCondition.boundsLevel = LEVEL_DISTRICT;
    } else if (zoom < ZOOM_COMMUNITY) {
        this.searchCondition.boundsLevel = LEVEL_BUSINESS_AREA;
    } else {
        this.searchCondition.boundsLevel = LEVEL_COMMUNITY;
    }
    if (!this.listenEvent) {
        return false;
    }
    switch (this.searchCondition.updateMode) {
        case LOCATIONSEARCH:
            if (this.searchCondition.onMove) {
                $('#mapLocation').show().children('p.dangqian').children('span').html(city.name);
                if(this.searchCondition.houseType==TYPE_SALE){
                    $('#mapLocation>.junjia').children('span').html(Math.ceil(city.price)).show();
                }
            }
            this.updateLocationMap();//不是移动时搜索 不更新列表
            break;
        case SUBWAYSEARCH:
            if (this.searchCondition.onMove) {
                if (zoom >= ZOOM_COMMUNITY) {
                    $('#subwayLocation').hide();
                    $('#subwayLocation>.junjia').hide();
                    this.updateSubwayMap();
                }
            }
            if (zoom >= ZOOM_COMMUNITY) {
                this.updateSubwayMap();
            }
            break;
        case COMMUTESEARCH:
            if (this.searchCondition.onMove) {
                $('#commuteLocation').hide();
                $('#commuteLocation>.junjia').hide();
            }
            this.updateCommuteMap();
            break;
    }
};
//页面初始化事件
$(function () {
    wiwjMap.updateLocationMap(LEVEL_CITY, city.id);//更新地图 按城市更新列表
    WjMap.prototype.changeDistrict = function (districtId) {
        document.getElementById('businessArea').innerHTML = '';
        if (!this.mapData.locations[districtId]) {
            return false;
        }
        var list = [];
        var businessAreas = this.mapData.locations[districtId]['businessAreas'];//当前districtId下所有商圈

        //生成字母数组list
        for (var i = 0; i < 26; i++) {
            list[String.fromCharCode(65 + i)] = [];//输出A-Z  26个大写字母
        }
        //根据首字母把商圈塞进字母数组list
        for (var id in businessAreas) {
            var cid = businessAreas[id].spell.substr(0, 1).toUpperCase();
            list[cid].push(businessAreas[id]);

        }
        for (i in list) {
            if (list[i].length == 0) {
                continue;
            }
            var li = document.createElement('li');
            var span = document.createElement('span');
            var text = document.createTextNode(i);
            span.appendChild(text);
            span.className = 'zm';

            var p = document.createElement('p');
            p.className='tab-shq clear';
            for (id in list[i]) {
                var businessArea = list[i][id];
                var a = document.createElement('a');
                a.setAttribute('value', businessArea['id']);
                a.setAttribute('lng', businessArea['lng']);
                a.setAttribute('lat', businessArea['lat']);
                a.setAttribute('price', businessArea['price']);
                text = document.createTextNode(businessArea['name']);
                a.appendChild(text);
                p.appendChild(a);
            }
            li.appendChild(span);
            li.appendChild(p);
            document.getElementById("businessArea").appendChild(li);
        }
    };
    //显示地铁线列表
    WjMap.prototype.showSubwayLineList = function () {
        document.getElementById('subwayLine').innerHTML = '';
        var subwayLines = [];
        for (var id in wiwjMap.mapData.subwayLine) {
            subwayLines.push(wiwjMap.mapData.subwayLine[id]);
        }
        subwayLines.sort(function(a,b){
            return a['sort']-b['sort'];
        });
        for (var id in subwayLines) {
            var li = document.createElement('li');
            li.setAttribute('value', subwayLines[id]['lineid']);
            li.innerHTML = '<div class="xl-item"><p class="name fl">' + subwayLines[id]['name'] + '</p><i class="icon icon-arrow-r"></i>';
            li.innerHTML += subwayLines[id]['count'] ? '<span class="tao fr">' + subwayLines[id]['count'] + '</span></div>' : '<div>';
            document.getElementById("subwayLine").appendChild(li);
        }
        //地铁找房 地铁列表
        $("#subwayLine>li").hover(function () {
                var subwayLine = $(this).attr('value');
                document.getElementById('subwayStation').innerHTML = '';
                var stations = wiwjMap.mapData.subwayLine[subwayLine].stations;
                var stationList = [];
                var firstStation=null;
                for(var id in stations){
                    if('sort' in stations[id]){
                        stationList[stations[id].sort] = stations[id];
                    }
                }
                if(!stationList){
                    stationList = stations;
                }
                for (var id in stationList) {
                    var station = stationList[id];
                    if(!firstStation){
                        firstStation = station;
                    }
                    var li = document.createElement('li');
                    li.setAttribute('value', station.id);
                    li.innerHTML = '<i class="icon icon-xl"></i><a title="' + station.name + '">' + station.name+ '</a>';
                    document.getElementById('subwayStation').appendChild(li);
                }
                $(this).on('click', function () {
                    wiwjMap.searchCondition.subwayLine = $(this).attr('value');
                    wiwjMap.clickLocationElement(LEVEL_SUBWAY_LINE, $(this).attr('value'), new BMap.Point(firstStation.lng, firstStation.lat));
                    $(".curr-xian>span").html($(this).find('p').text());
                    $('.subway-list').hide();
                    $("#subwaySelectedBox").show();
                    showHouseList();
                });
                $(".xl-con").show().children('ul').css({top: 0});
                $("#subwayStation>li").on('click', function () {
                    wiwjMap.searchCondition.subwayLine = subwayLine;
                    var station = stations[$(this).attr('value')];
                    wiwjMap.clickLocationElement(LEVEL_SUBWAY_STATION, $(this).attr('value'), new BMap.Point(station.lng, station.lat));
                    $(".curr-xian>span").html($(this).children('a').attr('title'));
                    $('.subway-list').hide();
                    $("#subwaySelectedBox").show();
                    showHouseList();
                });
            },
            function () {
                $(".xl-con").hide();
            }
        );
    };
});
//更改找房条件
$('div.searchCondition>a,ul.searchCondition>li,dd.searchCondition>a').on('click', function () {


    var conditionType = $(this).parent().attr('id');
    var conditionValue = $(this).attr('value');

    if($.inArray(conditionType,[
            'room',
            'heading',
            'floor',
            'decoration',
            'saleTags',
            'rentTags',
            'rentBrand'
        ]) == -1){
        $(this).addClass("cur").siblings().removeClass("cur");
    }

    if (conditionType == 'updateMode') {
        $(this).addClass("cur");
        $(this).siblings().removeClass("cur");

        //切换找房模式
        switch (conditionValue) {
            //切换至区域找房
            case 'location':
                if (wiwjMap.searchCondition.updateMode == LOCATIONSEARCH) {
                    return false;
                }
                $('.conList').hide();
                $('.selected').hide();
                //显示搜索条件列表
                $('.location-list').show();
                $('.houseOrder').show();//房源列表条件框 唯一
                $('.house-scr-box').show();//房源列表列表框 唯一
                $('#locationSelectedBox').show();//地铁列表 唯一
                //清空其他找房模式数据
                wiwjMap.map.clearOverlays();
                wiwjMap.map.setMinZoom(ZOOM_DISTRICT);
                wiwjMap.map.setMaxZoom(ZOOM_COMMUNITY);
                wiwjMap.searchCondition.updateMode = LOCATIONSEARCH;
                wiwjMap.updateLocationMap(LEVEL_CITY, city.id);//更新地图 按城市更新列表
                break;
            //切换至地铁找房
            case 'subway':
                if (wiwjMap.searchCondition.updateMode == SUBWAYSEARCH) {
                    return false;
                }
                $('.houseOrder').hide();//房源列表条件框 唯一
                $('.house-scr-box').hide();//房源列表列表框 唯一
                $('.conList').hide();
                $('.selected').hide();

                //显示搜索条件列表
                $('.subway-list').show();
                $(".xl-tab-box").show();
                //清空其他找房模式数据
                wiwjMap.map.clearOverlays();
                wiwjMap.map.setMaxZoom(ZOOM_COMMUNITY);
                wiwjMap.map.setMinZoom(ZOOM_DISTRICT);
                wiwjMap.searchCondition.updateMode = SUBWAYSEARCH;
                wiwjMap.showSubwayLineList();
                break;
            //切换至通勤找房
            case 'commute':
                console.log('commute');
                if (wiwjMap.searchCondition.updateMode == COMMUTESEARCH) {
                    return false;
                }
                $('.houseOrder').hide();//房源列表条件框 唯一
                $('.house-scr-box').hide();//房源列表列表框 唯一
                $('.conList').hide();
                $('.selected').hide();
                //显示搜索条件列表

                $('.commute-list').show();
                $('.tq-search').addClass("show").removeClass("hide");
                //清空其他找房模式数据
                wiwjMap.map.clearOverlays();
                wiwjMap.map.setMinZoom(ZOOM_BUSINESSAREA);
                wiwjMap.map.clearOverlays();
                wiwjMap.searchCondition.updateMode = COMMUTESEARCH;
                break;
        }
    } else if (conditionType == 'surround') {
        wiwjMap.surroundSearch = conditionValue;
        wiwjMap.setSurroundElement();
    } else if (conditionType == 'order') {
        $('.icon-sort-up,.icon-sort-down').removeClass('hide').hide();
        switch (conditionValue) {
            case 'default':
                if (wiwjMap.searchCondition.order == 0) {
                    return false;
                }
                wiwjMap.searchCondition.order = 0;
                break;
            case 'price':
                if (wiwjMap.searchCondition.order == 3) {
                    wiwjMap.searchCondition.order = 4;
                    $('.icon-sort-down').eq([0]).show();
                } else {
                    wiwjMap.searchCondition.order = 3;
                    $('.icon-sort-up').eq([0]).show();
                }
                break;
            case 'time':
                if (wiwjMap.searchCondition.order == 7) {
                    wiwjMap.searchCondition.order = 8;
                    $('.icon-sort-down').eq([1]).show();
                } else {
                    wiwjMap.searchCondition.order = 7;
                    $('.icon-sort-up').eq([1]).show();
                }
                break;
        }
    }else if(conditionType=='houseType'){//选择租房或者二手房
        $('.junjia').hide();
        if(conditionValue==TYPE_SALE){
            $('#saleTags').show();
            $('#rentTags').hide();
            $('#rentType').parent().hide();
            $('#rentBrand').parent().hide();
        }else{
            $('#saleTags').hide();
            $('#rentTags').show();
            $('#rentType').parent().show();
            $('#rentBrand').parent().show();
        }
        wiwjMap.searchCondition[conditionType] = conditionValue;
        $('.top-qk').click();
    }else if(conditionType=='transport'){
        wiwjMap.searchCondition[conditionType] = conditionValue;
        if(conditionValue==1){
            $('#commuteTime>li:eq(0)').click();
        }else{
            $('#commuteTime>li:eq(1)').click();
        }
    }else{
        if($.inArray(conditionType,[
                'room',
                'heading',
                'floor',
                'decoration',
                'saleTags',
                'rentTags',
                'rentBrand'
            ]) == -1){
            wiwjMap.searchCondition[conditionType] = conditionValue;
        }else{
            if(conditionValue == 0){
                $(this).addClass("cur").siblings().removeClass("cur");
                wiwjMap.searchCondition[conditionType] = [];
            }else{
                var pointer = $.inArray(conditionValue,wiwjMap.searchCondition[conditionType]);
                if(pointer == -1){
                    wiwjMap.searchCondition[conditionType].push(conditionValue);
                    $(this).addClass("cur").siblings(':eq(0)').removeClass("cur");
                }else{
                    wiwjMap.searchCondition[conditionType].splice(pointer,1);
                    $(this).removeClass("cur");
                    if(wiwjMap.searchCondition[conditionType].length == 0){
                        $(this).siblings(':eq(0)').addClass("cur");
                    }
                }
            }
        }

        if($.inArray(conditionType,[
                'salePrices',
                'rentPrices',
                'buildArea',
                'room'
            ]) != -1){
            var tex = $(this).text();
            if(tex.indexOf('不限')!=-1){
                var id=$(this).parent().attr('id');
                switch (id){
                    case 'rentPrices':
                    case 'salePrices':tex='总价';break;
                    case 'buildArea':tex='面积';break;
                    case 'room':tex='房型';break;
                }
            }else if(conditionType == 'room'){
                console.log(wiwjMap.searchCondition.room.length);
                switch (wiwjMap.searchCondition.room.length){
                    case 0:
                        tex = '房型';break;
                    case 1:
                        break;
                    default:
                        tex = '多房型';
                }
            }
            $(this).parent().siblings().children("span").text(tex);
        }
    }

    switch (wiwjMap.searchCondition.updateMode) {
        case LOCATIONSEARCH:
            wiwjMap.updateLocationMap(wiwjMap.searchCondition.locationLevel, wiwjMap.searchCondition.locationId);//不是移动时搜索 按储存的找房区域更新列表
            break;
        case SUBWAYSEARCH:
            wiwjMap.updateSubwayMap(wiwjMap.searchCondition.locationLevel, wiwjMap.searchCondition.locationId);//不是移动时搜索 按储存的找房区域更新列表
            break;
        case COMMUTESEARCH:
            if (conditionType == 'transport') {
                if (conditionValue == 1) {
                    $('.transport_walk').show();
                    $('.transport_drive').hide();
                } else {
                    $('.transport_walk').hide();
                    $('.transport_drive').show();
                }
                return false;
            }
            if (conditionType == 'commuteTime') {
                return false;
            }
            wiwjMap.updateCommuteMap(wiwjMap.searchCondition.locationLevel, wiwjMap.searchCondition.locationId);//不是移动时搜索 按储存的找房区域更新列表
            break;
    }
});
//清空条件
$('.top-qk').on('click', function () {
    wiwjMap.searchCondition.salePrices = 0;//price 二手房价格
    wiwjMap.searchCondition.rentPrices = 0;//price 二手房价格
    wiwjMap.searchCondition.room = [];//楼层
    wiwjMap.searchCondition.floor = [];//楼层
    wiwjMap.searchCondition.heading = [];//朝向
    wiwjMap.searchCondition.buildAges = 0;//建筑年限
    wiwjMap.searchCondition.buildArea = 0;//建筑面积
    wiwjMap.searchCondition.decoration = [];//装修
    wiwjMap.searchCondition.saleTags = [];//tag 买房标签
    wiwjMap.searchCondition.rentTags = [];//tag 租房标签
    wiwjMap.searchCondition.order = 0;//order 价格排序 0默认 1升序 2降序 按价格 3升序 4降序
    wiwjMap.searchCondition.page = 1;//page 房源列表分页号
    $('#salePrices').siblings('h2').children('span').html('价格');
    $('#room').siblings('h2').children('span').html('房型');
    $('#buildArea').siblings('h2').children('span').html('面积');
    $('.top-menu-con').find('.cur').removeClass('cur');
    $('.top-menu-more').find('.searchCondition').each(function () {
        $(this).children('a:eq(0)').addClass('cur')
    });
    wiwjMap.clickLocationElement(wiwjMap.searchCondition.locationLevel,wiwjMap.searchCondition.locationId,wiwjMap.searchCondition.locationCoord);
    switch (wiwjMap.searchCondition.updateMode) {
        case LOCATIONSEARCH:
            //wiwjMap.map.centerAndZoom(new BMap.Point(city.lng,city.lat), ZOOM_DISTRICT);
            //wiwjMap.updateLocationMap(wiwjMap.searchCondition.locationLevel, wiwjMap.searchCondition.locationId);//不是移动时搜索 按储存的找房区域更新列表
            break;
        case SUBWAYSEARCH:
            break;
        case COMMUTESEARCH:
            //wiwjMap.map.centerAndZoom(new BMap.Point(city.lng,city.lat), ZOOM_DISTRICT);
            //wiwjMap.updateCommuteMap(wiwjMap.searchCondition.locationLevel, wiwjMap.searchCondition.locationId);//不是移动时搜索 按储存的找房区域更新列表
            break;
    }
});
//周边搜索按钮点击事件
$(".zb-menu a").click(function () {
    var tex = $(this).text();
    if(tex == '无'){
        tex = '周边';
    }
    var siSel = $(this).parent().siblings();
    siSel.children("span").text(tex);
});
//移动地图时搜索选中事件
$(".yidong").click(function () {
    if (wiwjMap.searchCondition['onMove']) {
        wiwjMap.searchCondition['onMove'] = false;
        $(this).removeClass("check-on");
    } else {
        wiwjMap.searchCondition['onMove'] = true;
        $(this).addClass("check-on");
    }
});
//区域找房 区域列表
$("#districts>li").on('mouseover', function () {
    var districtId = $(this).attr('value');
    wiwjMap.changeDistrict(districtId);
    $("#businessArea a").on('click', function () {
        var businessAreaName = $(this).text();
        var businessAreaId = $(this).attr('value');
        var businessAreaCoord = new BMap.Point(Number($(this).attr('lng')), Number($(this).attr('lat')));

        var price = $(this).attr('price');
        $('#mapLocation').show().children('p.dangqian').children('span').html(businessAreaName);
        var domLocationPrice = $('#mapLocation>.junjia');
        if (price&&price!='undefined'&&wiwjMap.searchCondition.houseType==TYPE_SALE) {
            domLocationPrice.children('span').html(price);
            domLocationPrice.show();
        } else {
            domLocationPrice.hide();
        }

        $(".curr-shanq span").text(businessAreaName);
        $(".curr-menu").removeClass("show");
        $(".icon-down").removeClass("icon-up");
        wiwjMap.clickLocationElement(LEVEL_BUSINESS_AREA, businessAreaId, businessAreaCoord);//不是移动时搜索 按商圈更新列表
    })
}).on('click', function () {
    var districtName = '';
    if ($(this).text() == '全部') {
        districtName = city.name;
    } else {
        districtName = $(this).text();
    }
    var districtCoord = new BMap.Point(Number($(this).attr('lng')), Number($(this).attr('lat')));
    $(".curr-shanq span").text(districtName);
    $(".curr-menu").removeClass("show");
    $(".icon-down").removeClass("icon-up");

    var price = $(this).attr('price');
    $('#mapLocation').show().children('p.dangqian').children('span').html(districtName);
    var domLocationPrice = $('#mapLocation>.junjia');
    if (price) {
        domLocationPrice.children('span').html(Math.ceil(price));
        domLocationPrice.show();
    } else {
        domLocationPrice.hide();
    }
    wiwjMap.clickLocationElement(LEVEL_DISTRICT, $(this).attr('value'), districtCoord);//不是移动时搜索 按行政区更新列表
});
//地铁找房切换地铁线地铁站
$('#subwaySelect').on('click', function () {
    wiwjMap.showSubwayLineList();
    $('#subwaySelectedBox').hide();
    $('.subway-list').show();
});
//通勤条件和查找结果切换
$(".chazhao-btn").click(function () {
    if(null == wiwjMap.searchCondition.landMark ) {
        wiwjMap.searchCondition.landMark = {};
    }
    if (!wiwjMap.searchCondition.landMark.name) {
        return false;
    }
    $('.commute-list').hide();
    $('#commuteSelectedBox').show();
    $('#commuteSelect').show();
    var commuteCondition = $('.tq-inp').val() + '/';
    commuteCondition += wiwjMap.searchCondition.transport == 1 ? '步行/' : '自驾/';
    commuteCondition += wiwjMap.searchCondition.commuteTime * 5 + '分钟以内';
    wiwjMap.updateCommuteMap(LEVEL_CITY, city.id);
    $('#commuteSelect span').html(commuteCondition);
    showHouseList();
});
//页首搜索框
$('.search-del').on('click', function () {
    var keyword=$(this).val().trim();
    delCookie(COOKIEKEY);
    $.ajax({
        type: "get",
        url: '/map/search',
        data: {
            'keyword':keyword,
            'type': wiwjMap.searchCondition.houseType
        },
        dataType: "json",
        success: function (data) {
            showSearch(data,keyword);
        }
    });
});
$("#searchBar").on('click',function(){
    showSearch([]);
}).on('keyup', function (event) {
    if($(this).val()){
        $('.btn-search').on('click',function(){
            if($('.search-menu').children('ul').children('li.hit').length){
                $('.search-menu').children('ul').children('li.hit').eq(0).click();
            }else{
                $('.search-menu').children('ul').children('li').eq(0).click();
            }
        });
        if(event.keyCode == 13){
            if($('.search-menu').children('ul').children('li.hit').length){
                $('.search-menu').children('ul').children('li.hit').eq(0).click();
            }else{
                $('.search-menu').children('ul').children('li').eq(0).click();
            }
        }else{
            var keyword = $(this).val().trim();
            $.ajax({
                type: "get",
                url: '/map/search',
                data: {
                    'keyword':keyword,
                    'type': wiwjMap.searchCondition.houseType
                },
                dataType: "json",
                success: function (data) {
                    showSearch(data,keyword);
                }
            });
        }
    }else{
        showSearch([]);
    }
});
function showHouseList() {
    //$('.houseOrder').show();
    $('.house-scr-box').show();
    var wH = $(window).height();
    var tqHouseT = $(".house-scr-box").offset().top;
    $(".house-scr-box").height(wH - tqHouseT - $(".arrow-btn").height());
}
function getSubwayLineByStation(stationId) {
    for (var line in wiwjMap.mapData.subwayLine) {
        for (var station in wiwjMap.mapData.subwayLine[line]['stations']) {
            if (stationId == station) {
                return wiwjMap.mapData.subwayLine[line].lineid;
            }
        }
    }
}
function showSearch(result,keyword) {
    var ul = '';
    var history=getCookie(COOKIEKEY);
    history = history?JSON.parse(history):[];
    if (result.length == 0) {
        if(history.length == 0){
            $('.search-hot').addClass('hide');
            $('.search-del').addClass('hide');
            $('.search-menu').addClass("hide");
            return false;
        }else{
            result = history;
            $('.search-hot').removeClass('hide');
            $('.search-del').removeClass('hide');
            $('.search-menu').removeClass("hide");
        }
    }else{
        $('.search-hot').addClass('hide');
        $('.search-del').addClass('hide');
        $('.search-menu').removeClass("hide");
    }
    for (var i in result) {
        ul += '<li level="' + result[i]['level'] + '" value="' + result[i]['id']+ '" label="' + result[i]['name']+ '" total="' + result[i]['total'] + '" lng="' + result[i]['lng'] + '" lat="' + result[i]['lat']+'"';
        if(keyword == result[i]['name'].trim()){
            ul += ' class="hit"';
        }
        ul += '><a>';
        switch (parseInt(result[i]['level'])) {
            case LEVEL_DISTRICT:
                ul += result[i]['name'];
                break;
            case LEVEL_BUSINESS_AREA:
                ul += result[i]['name'] + ' 商圈';
                break;
            case LEVEL_COMMUNITY:
                ul += result[i]['name'] + ' 小区';
                break;
            case LEVEL_SUBWAY_LINE:
                ul += '地铁' + result[i]['name'];
                break;
            case LEVEL_SUBWAY_STATION:
                ul += '地铁 ' + result[i]['name'] +' 站';
                break;
            default :
                ul += result[i]['name'];
        }
        ul += '</a><span>(' + result[i]['total'] + '套)</span></li>';
    }
    $('.search-menu ul').html(ul).children('li').on('click', function () {
        $(".search-menu").addClass("hide");
        var id = Number($(this).attr('value'));
        var name = $(this).attr('label');
        var level = Number($(this).attr('level'));
        var lng = $(this).attr('lng');
        var lat = $(this).attr('lat');
        var total = $(this).attr('total');
        var target ={'id':id,'name':name,'level':level,'lng':lng,'lat':lat,'total':total};
        setCookie(COOKIEKEY,target);
        if (level == LEVEL_SUBWAY_LINE || level == LEVEL_SUBWAY_STATION) {
            $('#updateMode').children('li').eq(1).click();
            if(level == LEVEL_SUBWAY_LINE){
                //获取地铁线第一站
                var line = wiwjMap.searchCondition.subwayLine = $(this).attr('value');
                var stations = wiwjMap.mapData.subwayLine[line].stations;
                var firstStation = Object.keys(wiwjMap.mapData.subwayLine[line].stations)[0];
                firstStation=stations[firstStation];
                //显示地铁站第一线
                wiwjMap.clickLocationElement(LEVEL_SUBWAY_LINE, $(this).attr('value'), new BMap.Point(firstStation.lng, firstStation.lat));
                $(".curr-xian>span").html(name);
                $('.subway-list').hide();
                $("#subwaySelectedBox").show();
                showHouseList();
            }else{
                $('#updateMode>li:eq(1)').addClass("cur").siblings().removeClass("cur");
                $('.selectList').hide();
                $('.selected').hide();
                //显示选择站点
                $(".curr-xian>span").html(name);
                $('.subway-list').hide();
                $("#subwaySelectedBox").show();
                wiwjMap.clickLocationElement(level, id, new BMap.Point(Number(lng), Number(lat)));//不是移动时搜索 按行政区更新列表
                showHouseList();
            }
        } else {
            $('#mapLocation').show().children('p.dangqian').children('span').html(name);
            if(level==LEVEL_BUSINESS_AREA||level==LEVEL_DISTRICT){
                $('#mapLocation>.junjia').hide();
            }

            $('#updateMode').children('li').eq(0).click();
            wiwjMap.clickLocationElement(level, id, new BMap.Point(Number(lng), Number(lat)));//不是移动时搜索 按行政区更新列表
        }
        $('#searchBar').val(name);
    });
    $('.map-wrapper').on('click',function () {
        $(".search-menu").addClass("hide");
    });
}
//通勤找房关键词下拉框
$('.tq-inp').on('keyup', function (key) {
    var flag=true;
    $(this).on('click',function(){
        flag=true;
    });
    $('.gj-menu').on('mousedown',function(e){
        flag=false;
    });
    $(this).on('blur',function(e){
        if(flag){
            $(".gj-menu").hide();
        }
    });

    var landmarkName = $(this).val();
    clearTimeout(wiwjMap.searchLandmark);
    //从百度地图搜索地标
    if(landmarkName==''){
        $(".gj-menu").hide();
    }
    //通勤找房地标搜索
    wiwjMap.searchLandmark = setTimeout(
        function () {
            wiwjMap.landMarkSearch(landmarkName, callback);
        },
        50
    );
    if (key.keyCode == 13) {
        searchLandFirstMark();
    }
    function callback(landmarks) {
        if (!landmarks) {
            $(".gj-menu").hide();
            return false;
        }
        if(null == wiwjMap.searchCondition.landMark) {
            wiwjMap.searchCondition.landMark = {};
        }
        wiwjMap.searchCondition.landMark.list = landmarks;
        $('div.gj-menu>ul').html('');
        for (var i in landmarks) {
            var address=landmarks[i]['address'];
            address=address.split(';');
            var li = '<li lng="' + landmarks[i]['point']['lng'] + '" lat="' + landmarks[i]['point']['lat'] + '">';
            li+='<span class="tqTitle">' + landmarks[i]['title'].replace(/<[^>]+>/g,"") +'</span>';
            //li+='<span class="tqAddress">['+address+']</span></li>';
            $('div.gj-menu>ul').append(li);
        }
        if (landmarks.length > 0) {
            $(".gj-menu").show();
        } else {
            $(".gj-menu").hide();
        }
        $('div.gj-menu>ul>li').on('click', function () {
            wiwjMap.searchCondition.landMark.name = $(this).children('.tqTitle').html();
            wiwjMap.searchCondition.landMark.lng = $(this).attr('lng');
            wiwjMap.searchCondition.landMark.lat = $(this).attr('lat');
            wiwjMap.listenEvent = false;
            wiwjMap.map.centerAndZoom(new BMap.Point(parseFloat($(this).attr('lng')), parseFloat($(this).attr('lat'))), ZOOM_BUSINESSAREA);
            wiwjMap.setLandMarkElement();
            wiwjMap.listenEvent = true;
            var searchValue = wiwjMap.searchCondition.landMark.name;
            $('.tq-inp').val(searchValue);
            $(".gj-menu").hide();
        });

    }

    function searchLandFirstMark() {
        var landMarks = wiwjMap.searchCondition.landMark.list||[];
        if (!landMarks[0]) {
            return false;
        }
        wiwjMap.searchCondition.landMark.name = landMarks[0]['title'].replace(/<[^>]+>/g,"");
        wiwjMap.searchCondition.landMark.lng = landMarks[0]['point']['lng'];
        wiwjMap.searchCondition.landMark.lat = landMarks[0]['point']['lat'];
        wiwjMap.listenEvent = false;
        wiwjMap.map.centerAndZoom(landMarks[0]['point'], ZOOM_BUSINESSAREA);
        wiwjMap.setLandMarkElement();
        wiwjMap.listenEvent = true;
        var searchValue = wiwjMap.searchCondition.landMark.name;
        $('.tq-inp').val(searchValue);
        $(".gj-menu").hide();
    }
}).focus(function () {
    if ($(".gj-menu>ul>li").length > 0) {
        $(".gj-menu").show();
    }
}).on('blur', function () {
    //$(".gj-menu").hide();
});
//房源列表加载下一页
$(".house-scr-box").on('mouseover', function () {
    var boxHeight = $(this).height();
    var boxOffset = $(this).offset().top;
    var listHeight = $(this).children('.house-list').offset().top;
    var listOffset = $(this).children('.house-list').height();
    if (listHeight + listOffset <= boxHeight + boxOffset) {
        wiwjMap.loadNextPage();
    }
});

//搜索关键字存储cookie
function setCookie(key, values) {
    var Days = 10;
    var exp = new Date();
    //exp.setTime(exp.getTime() + Days*24*60*60*1000);
    exp.setTime(exp.getTime() + Days*1*60*1000);
    var history=getCookie(key);
    if(history) {
        var news=JSON.parse(history);
        var is_exist = false;
        for(var k in news) {
            if(news[k]['id'] == values['id']) {
                is_exist = true;
            }
        }
        if(is_exist == false) {
            news.unshift(values);
            //console.log(JSON.stringify(news));
            document.cookie = key +"="+ JSON.stringify(news) + ";expires=" + exp.toGMTString();
        }
    } else {
        var history=[];
        history.unshift(values);
        //console.log(JSON.stringify(history));
        document.cookie = key +"="+ JSON.stringify(history) + ";expires=" + exp.toGMTString();
    }
}

//获取cookie
function getCookie(cookie_name) {
    var allcookies = document.cookie;
    var cookie_pos = allcookies.indexOf(cookie_name);   //索引的长度
    // 如果找到了索引，就代表cookie存在，
    if (cookie_pos != -1) {
        // 把cookie_pos放在值的开始，只要给值加1即可。
        cookie_pos += cookie_name.length + 1;//这里容易出问题，所以请大家参考的时候自己好好研究一下
        var cookie_end = allcookies.indexOf(";", cookie_pos);
        if (cookie_end == -1) {
            cookie_end = allcookies.length;
        }
        var value = unescape(allcookies.substring(cookie_pos, cookie_end));//这里就可以得到你想要的cookie的值了。。。
    }
    console.log(value)
    return value;
}
//删除cookies
function delCookie(name){
    //console.log(name)
    var exp = new Date();
    exp.setTime(exp.getTime() - 1);
    var cval=getCookie(name);
    if(cval!=null)
        document.cookie= name + "="+cval+";expires="+exp.toGMTString();
}