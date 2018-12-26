/**
 * Created by JiangXiaolong on 2017/3/20.
 * Copyright 2017 我爱我家 All rights reserved.
 * 我爱我家地图找房基础封装类
 */
//使用严格模式
"use strict";
function WjMap(location) {
    /** 配置start **/
    this.config = {
        debugOn: true,//debug模式
        mapBoxId: 'WjMapPC',//实例化地图的DOM对象ID
        minZoom:11,
        defaultView://初始化配置
        {
            cityName: '北京',
            lng: '116.404',//Longitude经度
            lat: '39.915',//Latitude纬度
            zoom: 12
        },
        //样式配置
        style: {
            subwayLine: {strokeColor: "blue", strokeWeight: 4, strokeOpacity: 0.5}
        }
    };
    /** 配置end **/

    /** 预定义构造数据start **/
    var self = this;
    //初始化数据对象
    this.initialize = true;//地图初始化状态
    this.center = null;//地图中心点
    this.bounds = null;//地图显示范围

    //初始化地图组件对象
    this.defaultView = location || this.config.defaultView;
    this.mapData = {
        districts: null,
        subwayLine: null
    };
    //搜索条件
    this.searchCondition;
    this.api = {
        url:'/map/api/',
        storeUrl:'/map/store',
        requestPool: [],
        requestTemp: []
    };
    /** 预定义构造数据end **/

    /** 定义基础公有方法start **/
    this.getMapCoord = function (type) {
        var mapBounds = this.map.getBounds();
        var sw = mapBounds.getSouthWest();
        var ne = mapBounds.getNorthEast();
        var center = this.map.getCenter();
        this.center = {
            lng: center.lng,
            lat: center.lat
        };
        this.bounds = {
            e: ne.lng,//东
            w: sw.lng,//西
            s: sw.lat,//南
            n: ne.lat//北
        };
        switch(type){
            case 'bounds':return this.bounds;break;
            case 'center':return this.center;break;
            default :return {'center':this.center,'bounds':this.bounds};
        }
    };
    /** 定义基础公有方法end **/

    /** 定义地图组件私有方法start **/
    //预留地图移动事件接口
    function moveEvent(e) {
        if (!self.initialize) {
            self.mapMoveEvent(e);
        }
    }

    //预留地图缩放事件接口
    function zoomEvent(e) {
        if (!self.initialize) {
            self.mapZoomEvent(e);
        }
    }

    /** 定义地图组件私有方法end **/

    /** 初始化地图主模块start **/
    this.map = new BMap.Map(this.config.mapBoxId,{enableMapClick:false});//创建百度地图对象
    //this.map.enableScrollWheelZoom();//设置滚轮缩放
    this.map.setMinZoom(self.config.minZoom);
    this.map.addEventListener("moveend", moveEvent);//绑定移动事件
    this.map.addEventListener("zoomend", zoomEvent);//绑定缩放事件
    this.map.setCurrentCity(this.defaultView.cityName);//设置地图可视中心点
    this.map.centerAndZoom(new BMap.Point(this.defaultView.lng, this.defaultView.lat), this.defaultView.zoom); //设定地图的中心点和坐标并将地图显示在地图容器中
    this.initialize = false;//地图初始化状态
    /** 初始化地图主模块end **/
}
/**
 * 构造函数end
 **/

/**
 * 地图组件交互start
 **/
//周边搜索
WjMap.prototype.setSurroundElement = function () {
    var self=this;
    var i;
    if(!this.surroundSearch){
        if(self.surroundMark){
            for(i in self.surroundMark){
                self.map.removeOverlay(self.surroundMark[i]);
            }
        }
        self.surroundMark=[];
        return false;
    }
    else if(this.surroundSearch=='我爱我家'){
        this.set5i5jStoreElement();
        return true;
    }
    var local = new BMap.LocalSearch(self.map,{
        onSearchComplete:function(results){
            for(i in self.surroundMark){
                self.map.removeOverlay(self.surroundMark[i]);
            }
            for(i=0;i<results.getCurrentNumPois();i++){
                var poi=results.getPoi(i);
                poi.locationType=self.surroundSearch;
                self.surroundMark[i]=new self.poly.marker(poi);
                self.map.addOverlay(self.surroundMark[i]);
            }
        }
    });
    local.setPageCapacity(40);
    var bounds = self.map.getBounds();
    local.searchInBounds(self.surroundSearch, bounds);
};
//我爱我家店铺搜索
WjMap.prototype.set5i5jStoreElement=function(){
    var self=this;
    var bounds=self.getMapCoord('bounds');
    var data = '?'+http_build_query({bounds:JSON.stringify(bounds)});
    self.getAjaxData(self.api.storeUrl,data,function(results){
        var i;
        var temp;
        if(self.surroundMark){
            for(i in self.surroundMark){
                self.map.removeOverlay(self.surroundMark[i]);
            }
        }else{
            self.surroundMark=[];
        }
        for(i=0;i<results.data.res.length;i++){
            temp=results.data.res[i];
            if(temp.shopsname){
                temp.title=temp.shopsname;
            }
            temp.point=new BMap.Point(Number(temp.lat),Number(temp.lng));
            temp.locationType='我爱我家';
            self.surroundMark[i]=new self.poly.marker(temp);
            self.map.addOverlay(self.surroundMark[i]);
        }

    });
};
//地标搜索
WjMap.prototype.landMarkSearch = function (destination, callback) {
    var landmark = new BMap.LocalSearch(this.map, {
        onSearchComplete: function (results) {
            if(!results){
                return false;
            }
            var s = bus = [];
            for (var i = 0; i < results.getCurrentNumPois(); i++) {
                if(results.getPoi(i).tags&&results.getPoi(i).tags[0]=='交通设施'){
                    var bus = results.getPoi(i);
                    bus.title=bus.title+' '+bus.tags[1];
                    s.push(bus);
                }else{
                    s.push(results.getPoi(i));
                }
            }
            callback(s);
        }
    });
    landmark.setPageCapacity(8);
    landmark.search(destination);
};
/**
 * 地图组件交互end
 **/

/**
 * 地图数据交互start
 * 用户点击聚合点 更新房源列表
 * 地图不点击聚合点 不更新房源列表
 **/
WjMap.prototype.getAjaxData = function (requestUrl, data, callBack) {
    /** 处理传入链接和回调方法 **/
    if (typeof requestUrl != 'string') {
        console.log('传入接口链接错误');
        return false;
    }
    if (typeof data != 'string') {
        console.log('传入数据错误');
        return false;
    }
    var onComplete;
    if (typeof callBack == 'function') {
        onComplete = callBack;
    } else if (typeof callBack == 'object' && typeof callBack.onComplete == 'function') {
        onComplete = callBack.onComplete;
    } else {
        console.log('回调方法未定义');
        return false;
    }
    var onExecute;
    if (typeof callBack == 'object' && typeof callBack.onExecute == 'function') {
        onExecute = callBack.onExecute
    }
    var onError = unsuccessFeedback;
    if (typeof callBack == 'object' && typeof callBack.onError == 'function') {
        onError = callBack.onError
    }

    /** 初始化接口链接start **/
    if (this.api.requestPool[requestUrl]) {
        if (this.api.requestTemp[requestUrl] && this.api.requestTemp[requestUrl] == data) {
            onComplete({code:204});
            return false;
        } else {
            this.api.requestTemp[requestUrl] = data;
            this.api.requestPool[requestUrl].onLoad = false;
            this.api.requestPool[requestUrl].abort();
        }
    } else {
        this.api.requestPool[requestUrl] = new XMLHttpRequest();
        if (!this.api.requestPool[requestUrl]) {
            console.log('浏览器不支持XMLHttpRequest');
            return false;
        }
    }
    var self = this;
    var apiRequest = this.api.requestPool[requestUrl];
    /** 初始化接口链接end **/

    /** 发送数据start **/
    //开启ajax链接
    try {
        apiRequest.open('GET', requestUrl + data, true);
        apiRequest.requestTemp = data;
        apiRequest.setRequestHeader("Content-Type", 'application/x-www-form-urlencoded');
        apiRequest.send();
    } catch (e) {
        console.log('您的浏览器版本过低,数据连接失败');
        console.log(e);
    }
    /** 发送数据end **/

    /** 处理回调数据start **/
        //回调数据
    apiRequest.onreadystatechange = function () {
        if (apiRequest.readyState == 4) {
            apiRequest.onload = false;
            if (apiRequest.status == 200) {
                try {
                    onComplete(JSON.parse(apiRequest.responseText));
                } catch (e) {
                    onError(500, e);
                }
            } else {
                if (apiRequest.status != 0) {
                    onError(apiRequest.status, apiRequest.responseText);
                }
            }
        } else {
            apiRequest.onload = true;
            try {
                if (onExecute) {
                    onExecute(apiRequest.readyState);
                }
            } catch (e) {
            }
        }
    };

    //回调未成功 反馈错误
    function unsuccessFeedback(error, data) {
        if (self.config.debugOn) {
            //console.log(error);
            //  console.log(data);
        }
    }

    /** 处理回调数据end **/
};
/**
 * 地图数据交互end
 **/

/**
 * 覆盖物集合start
 **/

//设定多种覆盖物
WjMap.prototype.poly = function () {
    //定义多边形覆盖物 行政区
    function border(data, style) {
        style = style || {strokeColor: "#aa3333", strokeWeight: 4, strokeOpacity: 0.5};
        var linePoints = [];
        var line = data.split(";");
        for (var i in line) {
            if (!line[i]) {
                continue;
            }
            var point = line[i].split(",");
            var linePoint = new BMap.Point(Number(point[0]), Number(point[1]));
            linePoints.push(linePoint);
        }
        return new BMap.Polygon(linePoints, style);
    }

    //定义线型覆盖物 地铁线
    function line(data, style) {
        style = style || {strokeColor: "#aa3333", strokeWeight: 4, strokeOpacity: 0.5};
        var linePoints = [];
        var point = data.split(";");
        for (var i in point) {
            if (!point[i]) {
                continue;
            }
            var coord = point[i].split(",");
            var linePoint = new BMap.Point(Number(coord[0]), Number(coord[1]));
            linePoints.push(linePoint);
        }
        return new BMap.Polyline(linePoints, style);
    }
    //定义圆形覆盖物
    function circle(data){
        return new BMap.Circle(data.point,data.range*1000,{strokeOpacity:0.1,strokeColor:"#fdc915",fillColor:"#fdc915",fillOpacity:0.2,enableClicking:false}); //创建圆
    }
    //区域、商圈
    function location(data, option) {
        var style = {
            r: 45,
            color: '#fff',
            fontSize: 14,//名称14 套数数字18
            fillColor: 'rgba(231,64,87,0.9)',
            fillColorMouseOver: 'rgba(251,177,0,0.9)',
            strokeWeight: 1,
            strokeColor: 'rgba(0,0,0,0)'
        };
        //设置标注点 样式
        var r = style.r;//点半径
        var labelOffset = 12;//文本框偏移量
        var labelLength = 76;//文本框边长
        var labelStyle = {
            'text-overflow':'ellipsis',
            padding: 0,
            // margin: '5 px auto' ,
            width: labelLength + 'px',
            height: labelLength + 'px',
            'text-align': 'center',
            'overflow': 'hidden',
            'font-size': style.fontSize + 'px',
            color: '#fff',
            background: 'none',
            border: 'none',
            'font-family': 'Microsoft YaHei,微软雅黑'
        };
        var markerStyle = {
            scale: r,
            fillColor: style.fillColor,
            strokeWeight: style.strokeWeight,
            strokeColor: style.strokeColor
        };
        //创建图片
        try {
            //设置标注点
            var icon;
            if(option.highLight){
                icon = new BMap.Icon(resUrl+"/images/map-icon3.png", new BMap.Size(100,100));
            }else{
                icon = new BMap.Icon(resUrl+"/images/map-icon4.png", new BMap.Size(100,100));
            }
            var icons = new BMap.Icon(resUrl+"/images/map-icon3.png", new BMap.Size(100,100));

            // var icon = new BMap.Symbol(BMap_Symbol_SHAPE_CIRCLE,markerStyle);
            var marker = new BMap.Marker(
                new BMap.Point(data.lng, data.lat),
                {
                    icon: icon
                }
            );
            marker.highLight=option.highLight;
            //文本框内文字处理
            var labelInside = '';
            //名称
            var name='<span>' + data.name + '</span>';
            //均价
            var marketPrice = !isNaN(data.price)&&data.price?'</br><span>' + Math.ceil(data.price) + '</span><br><span>元/㎡</span>':'';
            var mapPrice = !isNaN(data.price)&&data.price!=0?'</br><span>' + Math.ceil(data.price/100)/100 + '万/㎡</span>':'';
            //总数
            var total= data.total?'</br><span><strong style="font-size: 18px;">' + data.total + '套</strong></span>':'';
            var onsell= data.onsell?'</br><span style="font-size: 18px;">' + data.onsell + '套</span>':'';
            //均价涨跌
            var float='';
            float = '</br><span>';
            if(data.float>0){
                float += data.float + '%';
                float += '<i class="up3"></i></span>';
            }else if(data.float<0){
                float += (-data.float) + '%';
                float += '<i class="up3 turnOver"></i></span>';
            }else{
                float += '--%'
            }
            float += '</br><span>环比上月</span>';
            var padL='<div style="height:' + labelLength / 3 + 'px;width:' + labelLength + 'px"></div><span>';
            var padM='<div style="height:' + labelLength / 6 + 'px;width:' + labelLength + 'px"></div><span>';
            var padS='<div style="height:' + labelLength / 9 + 'px;width:' + labelLength + 'px"></div><span>';
            switch(option.mode){
                case 'price':
                    labelInside= marketPrice?padS+name+marketPrice:padL+name;
                    break;
                case 'onsell':
                    labelInside=onsell?padM+name+onsell:padL+name;
                    break;
                case 'float':
                    labelInside=float?padS+name+float:padL+name;
                    break;
                case 'rent':
                    if(total){
                        labelInside=padM+name+total;
                    }
                    else{
                        labelInside=padL+name;
                    }
                    break;
                default :
                    if(mapPrice&&total){
                        labelInside=padS+name+mapPrice+total;
                    }
                    else if(total && !mapPrice){
                        labelInside=padM+name+total;
                    }
                    else{
                        labelInside=padL+name;
                    }
                    break;
            }

            //设置文本框
            var labelBody = new BMap.Label(labelInside);
            labelBody.setOffset(new BMap.Size(labelOffset, labelOffset));
            labelBody.setStyle(labelStyle);
            marker.setLabel(labelBody);
            marker.setTitle(data.name);
            marker.id = data.id;
            marker.name = data.name;
            marker.price = data.price;
            marker.total = data.total;
            marker.time = data.time||null;
            //给点绑定事件
            marker.addEventListener('mouseover', function () {
                marker.setIcon(icons);
                if(!marker.highLight){
                    marker.setZIndex(10000);
                }
            });
            marker.addEventListener('mouseout', function () {
                marker.setIcon(icon);
                if(!marker.highLight){
                    marker.setZIndex(10001);
                }
            });
            if(option.highLight){
                marker.setZIndex(10002);
            }else{
                marker.setZIndex(10001);
            }
            if (typeof option.onClick == 'function') {
                option.onClick(marker);
            }
            if (typeof option.onMouseover == 'function') {
                option.onMouseover(marker);
            }
        } catch (e) {
            console.log(e);
        }
        return marker;
    }

    //小区
    function community(data, option) {
        var labelStyle = {
            cursor: 'pointer',
            padding:0,
            background:'none',
            border: 'none'
        };
        try {
            var icon;
            if(option.highLight){
                icon = new BMap.Icon(resUrl+"/images/map-icon1.png", new BMap.Size(13,7));
            }else{
                icon = new BMap.Icon(resUrl+"/images/map-icon2.png", new BMap.Size(13,7));
            }

            var iconMouseOver = new BMap.Icon(resUrl+"/images/map-icon1.png", new BMap.Size(13,7));

            var marker = new BMap.Marker(
                new BMap.Point(data.lng, data.lat),
                {
                    icon: icon
                }

            );
            marker.highLight=option.highLight;

            //设置标注的偏移量
            //marker.setOffset(new BMap.Size(43,-24));
            var labelInside ='';
            labelInside += '<span>'+data.name;
            switch (option.mode){
                case 'price':
                    labelInside+=labelInside?'&nbsp;&nbsp;' + Math.ceil(data.price/100)/100 + '万/㎡':'';
                    break;
                case 'onsell':
                    labelInside += labelInside?'&nbsp;&nbsp;('+ data.onsell + '套)':'';
                    break;
                case 'float':
                    var float = (data.float&&data.float!==0)?'&nbsp;&nbsp;' + Math.abs(data.float) + '%':'&nbsp;&nbsp;--%';
                    if(data.float>0){
                        float +='<i class="up2"></i>';
                    }else if(data.float<0){
                        float +='<i class="up2 turnOver"></i>';
                    }
                    labelInside += float;
                    break;
                case 'rent':
                    if(data.total){
                        labelInside+='&nbsp;&nbsp;' + data.total + '套';
                    }
                    break;
                default :
                    if (!isNaN(data.price)&&data.price!=0&&data.price!=null) {
                        if(data.total){
                            labelInside += '&nbsp;&nbsp;' + Math.ceil(data.price/100)/100 + '万/㎡ (' + data.total + '套)';
                        }else{
                            labelInside += '&nbsp;&nbsp;' + Math.ceil(data.price/100)/100 + '万/㎡';
                        }
                    } else {
                        if(data.total){
                            labelInside+='&nbsp;&nbsp;(' + data.total + '套)';
                        }
                    }
                    break;
            }
            labelInside+='</span>';

            labelInside+= data.distance ?'<p>'+Math.ceil(data.distance*1000)+'米</p>':'';

            var labelHighLight = '<div class="cLabel highLight">'+labelInside+'</div>';
            var labelLowLight = '<div class="cLabel">'+labelInside+'</div>';

            var labelBody = new BMap.Label();

            labelBody.setOffset(new BMap.Size(-34,-34));
            labelBody.setStyle(labelStyle);
            marker.setLabel(labelBody);

            if(option.highLight){
                labelBody.setContent(labelHighLight);
                marker.setTop(true);
            }else{
                labelBody.setContent(labelLowLight);
                marker.setTop(false);
            }

            //给点绑定事件
            if (typeof option.onClick == 'function') {
                option.onClick(marker);
            }
            if (typeof option.onMouseover == 'function') {
                option.onMouseover(marker);
            }
            marker.mouseover = false;
            marker.setHighLight = function(timeout){
                if(!marker.highLight && !marker.mouseover){
                    marker.setIcon(iconMouseOver);
                    labelBody.setContent(labelHighLight);
                    marker.setTop(true);
                    if(!timeout){
                        setTimeout(function(){
                            marker.setLowLight();
                            marker.mouseover = false;
                        },500)
                    }
                }
            };
            marker.setLowLight = function(){
                if(!marker.highLight && marker.mouseover){
                    marker.setIcon(icon);
                    labelBody.setContent(labelLowLight);
                    marker.setTop(false);
                }
            };

            labelBody.addEventListener('mouseover', function (e) {
                //icon.setFillColor(style.fillColorMouseOver);
                marker.setHighLight();
                marker.mouseover = true;
                e.returnValue= true;
            },false);
            labelBody.addEventListener('mouseout', function (e) {
                // icon.setFillColor(style.fillColor);
                marker.setLowLight();
                marker.mouseover = false;
                e.returnValue= true;
            },false);

            marker.id = data.id;
            marker.name = data.name;
            marker.price = data.price;
            marker.total = data.total;
            marker.distance = data.distance||null;
        } catch (e) {
            console.log(e);
        }
        return marker;
    }

    //地铁站覆盖物
    function subwayStation(data,option){
        var style = {
            color: '#fff',
            fontSize: 12//名称14 套数数字18
        };
        //设置标注点 样式
        var labelOffset = 12;//文本框偏移量
        var labelLength = 76;//文本框边长
        var labelStyle = {
            padding: 0,
            // margin: '5 px auto' ,
            width: labelLength + 'px',
            height: labelLength + 'px',
            overflow: 'hidden',
            display:'table',
            'text-align': 'center',
            'font-size': style.fontSize + 'px',
            color: '#fff',
            background: 'none',
            border: 'none',
            'font-family': 'Microsoft YaHei'
        };
        //创建图片
        try {
            //设置标注点
            var icon = new BMap.Icon("../images/xjt1.png", new BMap.Size(100,100));
            var marker = new BMap.Marker(
                new BMap.Point(data.lng,data.lat),
                {
                    icon: icon
                }
            );
            var labelInside = '<strong style="display:table-cell;vertical-align:middle;word-wrap:break-word;word-break:break-all;" width="'+labelLength+'">' + data.name + '</strong>';

            //设置文本框
            var labelBody = new BMap.Label(labelInside);
            labelBody.setOffset(new BMap.Size(labelOffset, labelOffset));
            labelBody.setStyle(labelStyle);
            marker.setLabel(labelBody);
            marker.id = data.id;
            marker.name = data.name;
            marker.price = data.price;
            marker.total = data.count;
            //给点绑定事件
            if (typeof option.onClick == 'function') {
                option.onClick(marker);
            }
        } catch (e) {
            console.log(e);
        }
        return marker;
    }
    //通勤找房地标覆盖物
    function landMark(data,option){
        var style = {
            color: '#fff',
            fontSize: 14//名称14 套数数字18
        };
        //设置标注点 样式
        var labelOffset = 12;//文本框偏移量
        var labelLength = 76;//文本框边长
        var labelStyle = {
            padding: 0,
            // margin: '5 px auto' ,
            width: labelLength + 'px',
            height: labelLength + 'px',
            overflow: 'hidden',
            display:'table',
            'text-align': 'center',
            'font-size': style.fontSize + 'px',
            color: '#fff',
            background: 'none',
            border: 'none',
            'font-family': 'Microsoft YaHei'
        };
        //创建图片
        try {
            //设置标注点
            var icon = new BMap.Icon("../images/xjt1.png", new BMap.Size(100,100));
            var marker = new BMap.Marker(
                data.point,
                {
                    icon: icon
                }
            );
            var labelInside = '<strong style="display:table-cell;vertical-align:middle;word-wrap:break-word;word-break:break-all;white-space:initial;" width="'+labelLength+'">' + data.name + '</strong>';

            //设置文本框
            var labelBody = new BMap.Label(labelInside);
            labelBody.setOffset(new BMap.Size(labelOffset, labelOffset));
            labelBody.setStyle(labelStyle);
            marker.setLabel(labelBody);
            marker.name = data.name;
            //给点绑定事件
            if (typeof option.onClick == 'function') {
                option.onClick(marker);
            }
        } catch (e) {
            console.log(e);
        }
        return marker;
    }
    //周边搜索覆盖物
    //function marker(data,type){
    //    var icon;
    //    switch (data.locationType){
    //        case '公交':icon = new BMap.Icon(resUrl+"/images/icon-dw3.png", new BMap.Size(20,26));break;
    //        case '地铁':icon = new BMap.Icon(resUrl+"/images/icon-dw1.png", new BMap.Size(20,26));break;
    //        case '学校':icon = new BMap.Icon(resUrl+"/images/icon-dw4.png", new BMap.Size(20,26));break;
    //        case '银行':icon = new BMap.Icon(resUrl+"/images/icon-dw6.png", new BMap.Size(20,26));break;
    //        case '我爱我家':icon = new BMap.Icon(resUrl+"/images/icon-dw2.png", new BMap.Size(20,26));break;
    //        default :icon = new BMap.Icon(resUrl+"/images/icon-dw5.png", new BMap.Size(20,26));
    //    }
    //    var marker = new BMap.Marker(data.point,{
    //        icon:icon,
    //        enableMassClear:false
    //    });
    //    var title='';
    //    if(data.title){
    //        title=data.title;
    //    }else if(data.name){
    //        title=data.name;
    //    }
    //    marker.setTitle(title);
    //    return marker;
    //}
    //云麻点
    function points(data, style) {
        if (document.createElement('canvas').getContext) {  // 判断当前浏览器是否支持绘制海量点
            var markers = [];
            for (var i in data) {
                var lng = Number(data[i].point.lng) || null;
                var lat = Number(data[i].point.lat) || null;
                if (!lng || !lat) continue;
                var point = new BMap.Point(lng, lat);
                point.title = data[i].title;
                point.info = data[i].address;
                markers.push(point);
            }
            var options = {
                size: BMAP_POINT_SIZE_BIGGER,
                shape: BMAP_POINT_SHAPE_WATERDROP,
                color: '#d340c3'
            };
            var pointCollection = new BMap.PointCollection(markers, options);  // 初始化PointCollection
            pointCollection.addEventListener('click', function (e) {
                alert(e.point.title + '<br>' + e.point.info);  // 监听点击事件
            });
            return pointCollection;
        } else {
            alert('请在chrome、safari、IE8+以上浏览器查看本示例');
        }
    }

    //点聚合
    function conflux(data, option) {
        var style;
        //设置样式
        try {
            style = {
                r: option.style.r,
                color: option.style.color,
                fontSize: option.style.fontSize,
                fillColor: option.style.fillColor,
                strokeWeight: option.style.strokeWeight,
                strokeColor: option.style.strokeWeight
            };
        } catch (e) {
            //如果格式有误则使用默认设置
            style = {
                r: 40,
                color: '#fff',
                fontSize: 14,
                fillColor: 'rgba(100,100,255,0.8)',
                strokeWeight: 1,
                strokeColor: 'rgba(0,0,0,0)'
            };
        }

        //设置标注点 样式
        var r = style.r;//点半径
        var labelOffset = (1 - Math.sqrt(2) / 2) * r;//文本框偏移量
        var labelLength = Math.sqrt(2) * r;//文本框边长

        var labelStyle = {
            padding: 0,
            margin: 0,
            width: labelLength + 'px',
            height: labelLength + 'px',
            'text-align': 'center',
            'overflow': 'hidden',
            'font-size': style.fontSize + 'px',
            color: '#fff',
            background: 'none',
            border: 'none',
            'font-family': 'Microsoft YaHei'
        };
        var markerStyle = {
            scale: r,
            fillColor: style.fillColor,
            strokeWeight: style.strokeWeight,
            strokeColor: style.strokeColor
        };
        try {
            //设置标注点
            var marker = new BMap.Marker(
                new BMap.Point(data.lng, data.lat),
                new BMap.Point(data.lng, data.lat),
                {
                    icon: new BMap.Symbol(BMap_Symbol_SHAPE_CIRCLE, markerStyle)
                }
            );
            marker.id = data.id;
            marker.name = data.name;
            marker.price = data.price;
            marker.total = data.total;
            //设置文本框
            var label = new BMap.Label(data.name + '<br/>' + data.price + '<br/>' + data.total);
            label.setOffset(new BMap.Size(labelOffset, labelOffset));
            label.setStyle(labelStyle);
            marker.setLabel(label);

            //给点绑定事件
            if (typeof option.onClick == 'function') {
                option.onClick(marker);
            }
            if (typeof option.onMouseover == 'function') {
                option.onMouseover(marker);
            }
        } catch (e) {
            console.log(e);
        }
        return marker;
    }

    //定位点 1-1内嵌文字
    function marker1(data, option) {
        var marker = new BMap.Marker(new BMap.Point(data.lng, data.lat));
        marker.setTitle(data.name);
        //marker.setLabel(data[i].message);
        //给点绑定事件
        if (typeof option.onClick == 'function') {
            option.onClick(marker);
        }
        if (typeof option.onMouseover == 'function') {
            option.onMouseover(marker);
        }
    }

    //定位点 1-2内嵌图标
    function marker2(data, style) {

    }

    //定位点 1-3圆形图标
    function marker3(data, style) {

    }

    //定位点 1-4圆形环渐变色
    function marker4(data, style) {

    }

    //定位点 1-5圆形环渐变色
    function marker5(data, style) {

    }

    //弹出框 1-1直角样式
    function box1(data, style) {

    }

    //弹出框 1-2圆角样式
    function box2(data, style) {

    }

    //弹出框 1-3多行弹出样式
    function box3(data, style) {

    }

    //弹出框 1-4定位-右出弹框样式
    function box4(data, style) {

    }

    return {
        border: border,
        line: line,
        circle:circle,
        location: location,
        community: community,
        subwayStation:subwayStation,
        landMark:landMark,
        points: points,
        conflux: conflux,
        marker: marker
    };
}();
/** 覆盖物方法集合end **/

//模拟php的http_build_query功能
function http_build_query(urlCondition) {
    try {
        if (typeof urlCondition != 'object') {
            throw typeof urlCondition;
        }
        var url = '';
        var head = true;
        for (var id in urlCondition) {
            if (head) {
                url += id + '=' + urlCondition[id];
                head = false;
            } else {
                url += '&' + id + '=' + urlCondition[id];
            }
        }
        return url;
    } catch (e) {
        console.log(e);
        return '';
    }
}