var audio = new Audio();

$(document).ready(function() {

    $('.word').click(function(event) {
        event.preventDefault();  // Prevent the default action of following the link

        var name = $(this).data('name');
        var study_lang = $(this).data('lang');
        var phrase_id = $(this).data('id')
        var url = '/catalogue/get_word_data/' + study_lang + '/' + name + '/';

        $.ajax({
            url: url,
            type: 'GET',
            success: function(response) {
                $('#modal1 .modal-title').text(name);  // modal title
                $('#modal1 .modal-body b[name="definition"]').text(response.definition);
                $('#modal1 .modal-body b[name="freq_rank"]').text(response.freq_rank);
                //$('#modal1 .modal-body b[name="wpm"]').text(response.wpm);
                if (study_lang == 'es')
                    $('#modal1 .modal-body a[name="reverso"]').attr('href', 'https://conjugator.reverso.net/conjugation-spanish-verb-' + name + '.html');
                if (study_lang == 'zh')
                    $('#modal1 .modal-body b[name="text_freq_rank"]').text(response.text_freq_rank);
                    $('#modal1 .modal-body b[name="hanzi_radicals_string"]').text(response.hanzi_radicals_string);
                    $('#modal1 .modal-body b[name="pinyin"]').text(response.pinyin);
                $('#modal1 .modal-body a[name="full_info"]').attr('href', '/catalogue/word/' + study_lang + '/' + name + '/');
                $('#modal1 input[name="phrase_id"]').val(phrase_id);  // make flashcard creation work
                $('#modal1').modal('show');  // Show the modal
                audio.onended = function() {};  // Reset the onended function
                audio.src = response.audio_url;
                audio.play();
            },
            error: function(xhr, status, error) {
                console.log('Error:', error);
            }
        });
    });

});
