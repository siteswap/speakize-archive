"user strict";

$(document).ready(function () {
	$(".mode--toggle").on("click", function () {
		setTheme(localStorage.getItem("theme"));
	});
	if (localStorage.getItem("theme") == "dark") {
		localStorage.setItem("theme", "light");
	} else {
		localStorage.setItem("theme", "dark");
	}
	setTheme(localStorage.getItem("theme"));
	function setTheme(theme) {
		if (theme == "light") {
			localStorage.setItem("theme", "dark");
			$("html").attr("data-bs-theme", "dark");
			$(".mode--toggle").find("img").attr("src", "/static/fp_assets/img/sun.png");
		} else {
			localStorage.setItem("theme", "light");
			$("html").attr("data-bs-theme", "light");
			$(".mode--toggle").find("img").attr("src", "/static/fp_assets/img/moon.png");
		}
	}

	$(".work__tabs__wrap .nav-item").on("click", function () {
		$(".work__tab__content video").each(function () {
			$(this)[0].pause();
		});
	});
});
