// ==UserScript==
// @name         SVG Extractor with Preview and Download
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  提取页面中的所有 SVG，提供预览并选择下载 SVG 或 PNG（PNG 尺寸根据 SVG 长宽比例调整），增加预览区关闭功能，支持外部 SVG 文件
// @author       般若
// @match        *://*/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// ==/UserScript==

(function() {
    'use strict';

    // 创建预览容器
    const previewContainer = document.createElement('div');
    previewContainer.style.position = 'fixed';
    previewContainer.style.bottom = '20px';
    previewContainer.style.right = '20px';
    previewContainer.style.zIndex = '10000';
    previewContainer.style.backgroundColor = 'white';
    previewContainer.style.padding = '10px';
    previewContainer.style.border = '1px solid #ccc';
    previewContainer.style.borderRadius = '5px';
    previewContainer.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.1)';
    previewContainer.style.maxHeight = '80vh';
    previewContainer.style.overflowY = 'auto';
    document.body.appendChild(previewContainer);

    // 创建关闭按钮
    const closeButton = document.createElement('button');
    closeButton.innerText = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '5px';
    closeButton.style.right = '5px';
    closeButton.style.backgroundColor = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '16px';
    closeButton.style.cursor = 'pointer';
    closeButton.addEventListener('click', () => {
        previewContainer.style.display = 'none';
    });
    previewContainer.appendChild(closeButton);

    // 创建提取按钮
    const extractButton = document.createElement('button');
    extractButton.innerText = '提取 SVG';
    extractButton.style.position = 'fixed';
    extractButton.style.bottom = '20px';
    extractButton.style.left = '20px';
    extractButton.style.zIndex = '10000';
    extractButton.style.padding = '10px';
    extractButton.style.backgroundColor = '#007bff';
    extractButton.style.color = 'white';
    extractButton.style.border = 'none';
    extractButton.style.borderRadius = '5px';
    extractButton.style.cursor = 'pointer';
    document.body.appendChild(extractButton);

    // 加载外部 SVG 文件并将其转换为内联 SVG
    async function loadAndInlineExternalSVGs() {
        const imgElements = Array.from(document.querySelectorAll('img[src$=".svg"]'));
        for (const img of imgElements) {
            try {
                const response = await fetch(img.src);
                const svgText = await response.text();
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgElement = svgDoc.querySelector('svg');
                if (svgElement) {
                    img.replaceWith(svgElement);
                }
            } catch (error) {
                console.error('Failed to load and inline SVG:', error);
            }
        }
    }

    // 提取页面中的所有 SVG 元素
    function extractSVGs() {
        const svgs = Array.from(document.querySelectorAll('svg')).map((svg, index) => {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            return { url, name: `svg-${index + 1}.svg`, element: svg };
        });

        // 特别处理字统网动态更新的 SVG
        const dynamicSvgs = Array.from(document.querySelectorAll('svg[id="zusvgimgkage"], svg[style*="position:absolute;left:0;top:0;"]')).map((svg, index) => {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            return { url, name: `dynamic-svg-${index + 1}.svg`, element: svg };
        });

        return svgs.concat(dynamicSvgs);
    }

    // 显示 SVG 预览
    function showSVGPreviews(svgs) {
        previewContainer.innerHTML = '<h3 style="margin: 0 0 10px;">SVG 预览</h3>';
        previewContainer.appendChild(closeButton); // 重新添加关闭按钮
        svgs.forEach((svg, index) => {
            const previewItem = document.createElement('div');
            previewItem.style.marginBottom = '10px';
            previewItem.style.borderBottom = '1px solid #eee';
            previewItem.style.paddingBottom = '10px';

            // 显示 SVG 预览
            const previewImage = document.createElement('img');
            previewImage.src = svg.url;
            previewImage.style.maxWidth = '200px';
            previewImage.style.maxHeight = '100px';
            previewImage.style.display = 'block';
            previewImage.style.marginBottom = '5px';
            previewItem.appendChild(previewImage);

            // 下载 SVG 按钮
            const downloadSvgButton = document.createElement('button');
            downloadSvgButton.innerText = '下载 SVG';
            downloadSvgButton.style.marginRight = '5px';
            downloadSvgButton.addEventListener('click', () => {
                const link = document.createElement('a');
                link.href = svg.url;
                link.download = svg.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(svg.url);
            });
            previewItem.appendChild(downloadSvgButton);

            // 下载 PNG 按钮（透明背景）
            const downloadPngTransparentButton = document.createElement('button');
            downloadPngTransparentButton.innerText = '下载 PNG (透明)';
            downloadPngTransparentButton.style.marginRight = '5px';
            downloadPngTransparentButton.addEventListener('click', () => {
                downloadPNG(svg, index, false);
            });
            previewItem.appendChild(downloadPngTransparentButton);

            // 下载 PNG 按钮（白色背景）
            const downloadPngWhiteButton = document.createElement('button');
            downloadPngWhiteButton.innerText = '下载 PNG (白色背景)';
            downloadPngWhiteButton.addEventListener('click', () => {
                downloadPNG(svg, index, true);
            });
            previewItem.appendChild(downloadPngWhiteButton);

            previewContainer.appendChild(previewItem);
        });
    }

    // 下载 PNG 函数
    function downloadPNG(svg, index, isWhiteBackground) {
        const img = new Image();
        img.src = svg.url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const svgElement = svg.element;

            // 获取 SVG 的实际尺寸
            const svgWidth = svgElement.width.baseVal.value || svgElement.getBoundingClientRect().width;
            const svgHeight = svgElement.height.baseVal.value || svgElement.getBoundingClientRect().height;

            // 如果 SVG 的长宽不相等，则 PNG 尺寸为原 SVG 的 4 倍长 x 4 倍宽
            if (svgWidth !== svgHeight) {
                canvas.width = svgWidth * 4;
                canvas.height = svgHeight * 4;
            } else {
                canvas.width = 500;
                canvas.height = 500;
            }

            const ctx = canvas.getContext('2d');

            // 如果选择白色背景，填充白色
            if (isWhiteBackground) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 计算缩放比例
            const scale = Math.min(canvas.width / svgWidth, canvas.height / svgHeight);
            const scaledWidth = svgWidth * scale;
            const scaledHeight = svgHeight * scale;

            // 居中绘制
            const offsetX = (canvas.width - scaledWidth) / 2;
            const offsetY = (canvas.height - scaledHeight) / 2;

            ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `png-${index + 1}-${isWhiteBackground ? 'white' : 'transparent'}.png`;
                document.内容.appendChild(link);
                link.click();
                document.内容.removeChild(link);
                URL.revokeObjectURL(url);
            }, 'image/png');
        };
    }

    // 点击按钮提取并显示 SVG 预览
    extractButton.addEventListener('click', async () => {
        await loadAndInlineExternalSVGs(); // 加载并内联外部 SVG
        const svgs = extractSVGs();
        if (svgs.length > 0) {
            previewContainer.style.display = 'block'; // 显示预览区
            showSVGPreviews(svgs);
        } else {
            previewContainer.innerHTML = '<p>未找到 SVG 元素。</p>';
        }
    });
})();
