(function () {
    if (window.spa) return;

    let _;
    const STATUS_WAIT = 0;
    const STATUS_SEND = 1;
    const STATE_NORMAL = 0;

    const defaults = {
        querySelectorContent: 'main', //Селектор главного блока всего контента страницы, если null то заменится содержимое тега body
        classActiveLink: '_active',
        init: false,
        addToLink: '',
        status: STATUS_WAIT,
        state: STATE_NORMAL,
    };

    function SPA() {
        _ = this;

        if (arguments[0] && typeof arguments[0] === 'object') {
            _.options = extendDefaults(defaults, arguments[0]);
        } else {
            _.options = defaults;
        }

        for (let property in _.options) {
            if (_.options.hasOwnProperty(property)) {
                _[property] = _.options[property];
            }
        }

        if (document.readyState === 'complete') {
            initialize();
        } else {
            window.addEventListener('load', initialize);
        }
    }

    function initialize() {
        if (_.init) return;
        markLink();
        document.addEventListener('click', onClick);
        _.init = true;
    }

    function onClick(e) {
        const event = e || window.event;

        let target = event.target;
        while (target !== null) {
            if (target.tagName.toLowerCase() === 'a') break;
            if (target.getAttribute('href')) break;
            target = target.parentElement;
        }

        if (!target) return false;
        let targetHref = target.getAttribute('href');

        if (
            typeof target.dataset.state === 'undefined' && (
                typeof target.dataset.reload !== 'undefined' ||
                (
                    targetHref.substring(0, 1) !== '/' &&
                    targetHref.substring(0, 2) !== './' &&
                    targetHref.indexOf('://') !== -1 &&
                    targetHref.indexOf(location.host) === -1
                ) ||
                (targetHref.indexOf('/search') !== -1) ||
                (targetHref.indexOf('/debug') !== -1) ||
                (!!target.target && (target.target === '_blank' || target.target === '_self'))
            )
        ) {
            return false;
        }

        event.stopPropagation ? event.stopPropagation() : (event.cancelBubble = true);
        event.stopImmediatePropagation ? event.stopImmediatePropagation() : null;
        event.preventDefault ? event.preventDefault() : (event.returnValue = false);

        if (
            _.status === STATUS_SEND ||
            target.classList.contains(_.classActiveLink)
        ) {
            return false;
        }

        _.status = STATUS_SEND;

        let parent = target.parentElement;
        for (let i = 0, size = parent.childElementCount; i < size; i++) {
            let child = parent.children[i];
            if (child.tagName.toLowerCase() !== 'a' && child.classList.contains('_active') && child.hasAttribute('onclick')) {
                let tmp = child.getAttribute('onclick').split('.');
                let func = window;
                for (let i2 = 0, size2 = tmp.length; i2 < size2; i2++) {
                    tmp[i2] = tmp[i2].replace('()', '');
                    func = func[tmp[i2]];
                }
                func.call();
            } else {
                child.classList.remove(_.classActiveLink);
            }
        }

        target.classList.add(_.classActiveLink);

        if (target.getAttribute('href')) {
            markLink(target.getAttribute('href'));
        }

        let link = target.getAttribute('href');
        let saveParams;
        if (typeof target.dataset.save_params !== 'undefined') {
            saveParams = target.dataset.save_params === 'true';
        } else {
            saveParams = link.indexOf('?') !== -1;
        }

        loadData(link, target, saveParams);
    }

    function markLink(hrefTarget) {
        if (!hrefTarget) hrefTarget = document.location.pathname;
        let aElements = document.getElementsByTagName('a');

        for (let i = 0, size = aElements.length; i < size; i++) {
            let element = aElements[i];
            let href = element.getAttribute('href');
            if (href === hrefTarget) {
                element.classList.add(_.classActiveLink);
            } else {
                element.classList.remove(_.classActiveLink);
            }
        }
    }

    function loadData(link, activeLinkElement, saveUrlParams) {
        let querySelectorContent = _.querySelectorContent;
        if (typeof activeLinkElement !== 'undefined' && typeof activeLinkElement.dataset.content_class !== 'undefined') {
            querySelectorContent = activeLinkElement.dataset.content_class;
        }

        let contentElement = querySelectorContent === null ? document.body : document.querySelector(querySelectorContent);

        if (!contentElement) {
            this.status = STATUS_WAIT;
            console.error('Element with class ' + _.querySelectorContent + ' not found');
            return;
        }

        if (link.indexOf('?') !== -1) saveUrlParams = true;
        if (saveUrlParams !== true) saveUrlParams = false;


        if (saveUrlParams && link.indexOf('?') === -1 && document.location.search.length) {
            link += (document.location.search.indexOf('?') === -1 ? '?' : '') + document.location.search;
        }

        if (contentElement.getBoundingClientRect().top < 0) {
            window.scrollTo(0, 0);
        }

        let xhr = new XMLHttpRequest();
        xhr.withCredentials = true;

        let match = link.match(new RegExp('#.*$'));
        link = (match ? link.replace(match[0], '') : link) + _.addToLink;
        xhr.open('GET', link, true);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('Accept', 'text/html;q=0.9,*/*');
        xhr.send();

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== xhr.DONE) return;
            if (xhr.status !== 200) {
                location.reload();
            } else {
                if (location.href !== link) {
                    history.pushState('ajax', null, link);
                }

                insertResponse(contentElement, activeLinkElement, xhr.responseText, link);
            }
        };
    }

    function insertResponse(contentElement, activeLinkElement, responseText, link) {
        let mainBlock = document.createElement('div');
        let title = /<title>([^<]+)<\/title>/s.exec(responseText)[1];

        responseText = responseText.replace(/<![^>]*>/gi, '');
        responseText = responseText.replace(/<html[^>]*>/gi, '');
        responseText = responseText.replace(/<body[^>]*>/gi, '');
        responseText = responseText.replace(/<head[^>]*>[^<]*<\/head>/gm, '');
        responseText = responseText.replace('</body>', '');
        responseText = responseText.replace('</html>', '');

        mainBlock.innerHTML = responseText;

        if (contentElement.tagName.toLowerCase() === 'body') {
            contentElement.innerHTML = mainBlock.innerHTML;
        } else {
            let pathDOM = [];
            let node = contentElement;
            while (node !== null) {
                const arrayTags = Array.from(node.parentNode.children).filter((child) => {
                    return child.tagName === node.tagName;
                })
                let index = arrayTags.indexOf(node) + 1;

                pathDOM.push(arrayTags.length === 1 ? `${node.tagName.toLowerCase()}` : `${node.tagName.toLowerCase()}:nth-child(${index})`);

                node = node.parentElement;
                if (node === null || node.tagName.toLowerCase() === 'body') break;
            }

            pathDOM = pathDOM.reverse().join(' > ');
            const newElement = mainBlock.querySelector(pathDOM);

            contentElement.innerHTML = newElement.innerHTML;
            contentElement.setAttribute('class', newElement.getAttribute('class'));
        }

        markLink(link);

        document.title = title;

        window.onscroll = null;

        const oldScriptsElements = document.getElementsByTagName('script');
        const oldScripts = [];
        for (let i = 0, size = oldScriptsElements.length; i < size; i++) {
            oldScripts.push(oldScriptsElements[i].src);
        }

        const scripts = mainBlock.getElementsByTagName('script');
        for (let i = 0, size = scripts.length; i < size; i++) {
            if (oldScripts.indexOf(scripts[i].src) !== -1) continue;
            let script = document.createElement('script');
            script.type = 'text/javascript';
            if (typeof scripts[i].src !== 'undefined' && scripts[i].src !== null && scripts[i].src.length) {
                script.src = scripts[i].src;
            } else {
                script.innerHTML = scripts[i].innerHTML;
            }
            contentElement.appendChild(script);
        }

        _.status = STATUS_WAIT;
    }

    function extendDefaults(source, properties) {
        let property;
        for (property in properties) {
            if (properties.hasOwnProperty(property)) {
                source[property] = properties[property];
            }
        }
        return source;
    }

    window.spa = new SPA();
})();
