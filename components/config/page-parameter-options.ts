export type CriteriaOption = {
  code: string;
  label: string;
  score: number;
};

export type ParameterOption = {
  id: number;
  label: string;
  criteria: CriteriaOption[];
};

export const PAGE_PARAMETER_OPTIONS: Record<string, ParameterOption[]> = {
  "sub-perencanaan": [
    {
      id: 1,
      label: "Adanya keterkaitan antara Sasaran BLU/BLUD dengan Sasaran Strategis K/L/Pemda",
      criteria: [
        {
          code: "L5",
          label:
            "Level 5 - Sasaran strategis BLU/BLUD telah diselaraskan dengan sasaran strategis K/L/Pemda (dinas), seluruh unit layanan utama telah memiliki sasaran spesifik yang mendukung prioritas nasional di bidang kesehatan, telah diformalkan dalam RBA, dan telah dituangkan dalam Perjanjian Kinerja antara Pimpinan BLU/BLUD dengan Pimpinan K/L/Pemda",
          score: 5,
        },
        {
          code: "L4",
          label:
            "Level 4 - Sasaran strategis BLU/BLUD telah diselaraskan dengan sasaran strategis K/L/Pemda (dinas), seluruh unit layanan utama telah memiliki sasaran spesifik yang mendukung prioritas nasional di bidang kesehatan, dan telah diformalkan dalam RBA",
          score: 4,
        },
        {
          code: "L3",
          label:
            "Level 3 - Sasaran strategis BLU/BLUD telah diselaraskan dengan sasaran strategis K/L/Pemda (dinas), dan seluruh unit layanan utama telah memiliki sasaran spesifik yang mendukung prioritas nasional di bidang kesehatan",
          score: 3,
        },
        {
          code: "L2",
          label:
            "Level 2 - Terdapat sasaran strategis BLU/BLUD, namun belum spesifik ke unit layanan utama",
          score: 2,
        },
        {
          code: "L1",
          label:
            "Level 1 - Belum terdapat sasaran strategis di BLU/BLUD",
          score: 1,
        },
      ],
    },
    {
  id: 2,
  label: "Penetapan Sasaran Strategis sudah tepat",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Sasaran strategis BLU/BLUD sepenuhnya mendukung arah kebijakan K/L atau Pemda dan dijabarkan konsisten ke dalam RBA dan PK sebagai satu kesatuan yang logis dan terukur.",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Sasaran strategis mengacu pada arah K/L atau Pemda, dan keterkaitannya tercermin konsisten dalam RBA dan PK, meskipun belum sepenuhnya integratif.",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Sasaran strategis, RBA, dan PK mengangkat tema atau isu yang sejalan dengan prioritas pusat/daerah, namun belum terlihat kesinambungan logis antardokumen.",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Hanya sasaran strategis yang merujuk secara umum pada dokumen K/L atau Pemda; RBA dan PK belum mencerminkan arah tersebut.",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Sasaran strategis, RBA, dan PK disusun secara terpisah dan tidak merujuk pada arah kebijakan K/L atau Pemda.",
      score: 1,
    },
  ],
},
    {
  id: 3,
  label: "Penetapan Indikator Kinerja sudah tepat dan baik",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Sebesar 91% - 100% Indikator Kinerja yang ditetapkan sudah tepat dan baik",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Sebesar 81% - 90% Indikator Kinerja yang ditetapkan sudah tepat dan baik",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Sebesar 71% - 80% Indikator Kinerja yang ditetapkan sudah tepat dan baik",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Sebesar 61% - 70% Indikator Kinerja yang ditetapkan sudah tepat dan baik",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Sebesar ≤ 60% Indikator Kinerja yang ditetapkan sudah tepat dan baik",
      score: 1,
    },
  ],
},
    {
  id: 4,
  label: "Penetapan Target Kinerja sudah baik",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Sebesar 91% - 100% target kinerja yang ditetapkan sudah baik",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Sebesar 81% - 90% target kinerja yang ditetapkan sudah baik",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Sebesar 71% - 80% target kinerja yang ditetapkan sudah baik",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Sebesar 61% - 70% target kinerja yang ditetapkan sudah baik",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Sebesar ≤ 60% target kinerja yang ditetapkan sudah baik",
      score: 1,
    },
  ],
},
  ],

  "sub-kapabilitas-1": [
    {
  id: 5,
  label: "Efektivitas fungsi pengelola risiko",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Satgas/Unit MR telah berfungsi penuh, telah melakukan evaluasi, dan terdapat tanggungjawab kepada pimpinan",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Satgas/Unit MR telah berfungsi, namun hanya dapat berfungsi sebagian besar",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Satgas/Unit MR telah berfungsi, namun hanya dapat berfungsi sebagian kecil",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Belum terbentuk satgas pengelola Risiko/Unit Pengelola Risiko (Unit MR), terdapat fungsi yang menangani risiko",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Belum terbentuk satgas pengelola Risiko/Unit Pengelola Risiko (Unit MR)",
      score: 1,
    },
  ],
},
    {
  id: 6,
  label: "Keterlibatan aktif Dewan Pengawas dalam pengelolaan Risiko ",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Keterlibatan Dewan Pengawas dalam isu-isu Risiko lain BLU/BLUD dan kegiatan sosialisasi sangat memadai  dan telah tercantum dalam kebijakan Manajemen Risiko, serta terdapat persetujuan atas kebijakan risiko,  daftar risiko, dan rencana bisnis tahunan.",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Keterlibatan Dewan Pengawas dalam isu-isu Risiko lain BLU/BLUD dan kegiatan sosialisasi sangat memadai  dan telah tercantum dalam kebijakan Manajemen Risiko, serta terdapat persetujuan atas kebijakan risiko,  daftar risiko, dan rencana bisnis tahunan.",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Keterlibatan Dewan Pengawas dalam isu-isu Risiko lain BLU/BLUD telah memadai dan telah tercantum dalam kebijakan Manajemen Risiko, serta terdapat persetujuan atas kebijakan risiko dan daftar risiko",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Keterlibatan Dewan Pengawas dalam isu-isu Risiko lain BLU/BLUD cukup memadai dan telah tercantum dalam kebijakan Manajemen Risiko",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Keterlibatan Dewan Pengawas dalam isu-isu Risiko lain BLU/BLUD sangat kurang atau tidak ada sama sekali dan belum tercantum dalam kebijakan Manajemen Risiko",
      score: 1,
    },
  ],
},
{
  id: 7,
  label: "Eskalasi permasalahan kepada Dewan Pengawas telah dilaksanakan",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Eskalasi permasalahan berdampak besar kepada Dewan Pengawas telah dilaksanakan dan terdapat keputusan independen, serta terdapat kriteria eskalasi yang jelas. Dewan Pengawas tidak menghambat penanganan permasalahan.",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Eskalasi permasalahan berdampak besar kepada Dewan Pengawas telah dilaksanakan dan terdapat keputusan independen, serta terdapat kriteria eskalasi yang jelas",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Eskalasi permasalahan berdampak besar kepada Dewan Pengawas telah dilaksanakan dan terdapat kriteria eskalasi yang jelas",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Eskalasi permasalahan berdampak besar kepada Dewan Pengawas telah dilaksanakan dan belum terdapat kriteria eskalasi yang jelas",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Eskalasi permasalahan kepada Dewan Pengawas telah dilaksanakan, namun belum rutin dan belum terdapat kriteria eskalasi yang jelas",
      score: 1,
    },
  ],
},
{
  id: 8,
  label: "Tingkat pemahaman Risiko di jajaran Dewan Pengawas memadai, termasuk adanya komite khusus yang menangani MR BLU/BLUD",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Pemahaman seluruh anggota Dewan Pengawas terhadap Manajemen Risiko sangat memadai",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Pemahaman anggota Dewan Pengawas terhadap Manajemen Risiko telah memadai",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Pemahaman Dewan Pengawas terhadap Manajemen Risiko cukup memadai",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Pemahaman Dewan Pengawas terhadap Manajemen Risiko kurang memadai",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Pemahaman Dewan Pengawas terhadap Manajemen Risiko belum memadai",
      score: 1,
    },
  ],
},
{
  id: 9,
  label: "Pimpinan BLU/BLUD mengalokasikan sumber daya untuk penerapan manajemen risiko.",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Sudah mengalokasikan sumber daya secara memadai untuk penerapan manajemen risiko pada tingkat operasional unit kerja dan strategis BLU/BLUD",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Sudah mengalokasikan sumber daya secara memadai untuk penerapan manajemen risiko pada tingkat operasional unit kerja  namun pada tingkat strategis BLU/BLUD belum memadai",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Sudah mengalokasikan sumber daya secara memadai untuk penerapan manajemen risiko pada tingkat operasional unit kerja",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Sudah mengalokasikan sumber daya secara cukup memadai untuk penerapan manajemen risiko pada tingkat operasional unit kerja (menghapus istilah strategis unit kerja)",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Sudah mengalokasikan sumber daya untuk penerapan manajemen risiko pada tingkat operasional unit kerja namun belum memadai",
      score: 1,
    },
  ],
},
{
  id: 10,
  label: "Pimpinan BLU/BLUD menggunakan informasi terkait risiko dalam pengambilan keputusan",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Seluruh pengambilan keputusan telah mempertimbangkan risiko",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Sebagian besar pengambilan keputusan telah mempertimbangkan risiko",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Cukup banyak pengambilan keputusan yang telah mempertimbangkan risiko",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Sebagian kecil pengambilan keputusan telah mempertimbangkan risiko",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Seluruh pengambilan keputusan belum mempertimbangkan risiko",
      score: 1,
    },
  ],
},
{
  id: 11,
  label: "Pimpinan BLU/BLUD mendorong secara aktif penerapan manajemen risiko, melalui Penggunaan kinerja penerapan manajemen risiko sebagai indikator penilaian kinerja",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Kinerja penerapan manajemen risiko digunakan sebagai dasar penilaian kinerja pada seluruh Unit MR tingkatan operasional unit kerja, dan Unit MR tingkat strategis BLU/BLUD  secara memadai dan telah dievaluasi pencapaiannya",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Kinerja penerapan manajemen risiko digunakan sebagai dasar penilaian kinerja pada seluruh Unit MR tingkatan operasional unit kerja, dan Unit MR tingkat strategis BLU/BLUD  secara memadai ",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Kinerja penerapan manajemen risiko digunakan sebagai dasar penilaian kinerja pada seluruh Unit MR tingkatan operasional unit kerja secara memadai",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Kinerja penerapan manajemen risiko digunakan sebagai dasar penilaian kinerja pada sebagian besar (<70%) Unit MR tingkatan operasional unit kerja secara memadai",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Kinerja penerapan manajemen risiko belum digunakan sebagai dasar penilaian kinerja pada seluruh Unit MR tingkatan operasional unit kerja",
      score: 1,
    },
  ],
},
{
  id: 12,
  label: "Pimpinan BLU/BLUD membangun sistem pengaduan",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Telah terdapat kebijakan penerapan sistem pengaduan, telah disosialisasikan dan sebagian besar pengaduan telah ditindaklanjuti. Sistem pengaduan menjadi bagian dari pengukuran IKU BLU/BLUD, serta memiliki dampak dalam peningkatan kinerja.",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Telah terdapat kebijakan penerapan sistem pengaduan, telah disosialisasikan dan sebagian besar pengaduan telah ditindaklanjuti. Sistem pengaduan menjadi bagian dari pengukuran IKU BLU/BLUD",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Telah terdapat kebijakan penerapan sistem pengaduan, telah disosialisasikan dan cukup banyak pengaduan telah ditindaklanjuti",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Telah terdapat kebijakan penerapan sistem pengaduan, telah disosialisasikan dan sebagian kecil pengaduan telah ditindaklanjuti",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Telah terdapat kebijakan penerapan sistem pengaduan",
      score: 1,
    },
  ],
},
  ],

  "sub-kapabilitas-2": [
    {
  id: 13,
  label: "BLU/BLUD  telah memiliki Kebijakan Manajemen Risiko.",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - BLU/BLUD  telah memiliki Kebijakan Manajemen Risiko yang memadai, terintegrasi serta telah direviu secara berkala",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - BLU/BLUD  telah memiliki Kebijakan Manajemen Risiko yang memadai dan terintegrasi",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - BLU/BLUD  telah memiliki Kebijakan Manajemen Risiko yang memadai",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - BLU/BLUD  telah memiliki Kebijakan Manajemen Risiko namun belum memadai",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - BLU/BLUD  telah memiliki Kebijakan Manajemen Risiko namun sama sekali belum memuat persyaratan dalam kriteria memadai",
      score: 1,
    },
  ],
},
  ],

  "sub-kapabilitas-3": [
    {
  id: 14,
  label: "Pegawai telah mendapatkan fasilitas untuk meningkatkan kompetensi dan keterampilan terkait manajemen risiko",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Terdapat upaya peningkatan kompetensi dan keterampilan terkait manajemen risiko yang memadai dengan cakupan seluruh pegawai dan telah dievaluasi pencapaiannya",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Terdapat upaya peningkatan kompetensi dan keterampilan terkait manajemen risiko yang memadai dengan cakupan seluruh pegawai",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Terdapat upaya peningkatan kompetensi dan keterampilan terkait manajemen risikoyang memadai dengan cakupan sebagian besar pegawai",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Terdapat upaya peningkatan kompetensi dan keterampilan terkait manajemen risiko yang memadai dengan cakupan sebagian pegawai",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Terdapat upaya peningkatan kompetensi dan keterampilan terkait manajemen risiko namun belum memadai",
      score: 1,
    },
  ],
},
{
  id: 15,
  label: "Pegawai memiliki kesadaran terkait manajemen risiko/terdapat internalisasi budaya risiko",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Seluruh pegawai telah memiliki pemahaman terkait manajemen risiko",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Sebagian besar pegawai telah memiliki pemahaman terkait manajemen risiko",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Sebagian pegawai telah memiliki pemahaman terkait manajemen risiko",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Sebagian kecil pegawai telah memiliki pemahaman terkait manajemen risiko",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Beberapa pegawai telah memiliki kesadaran pemahaman terkait manajemen risiko",
      score: 1,
    },
  ],
},
  ],

  "sub-kapabilitas-4": [
    {
  id: 16,
  label: "Dalam rangka menciptakan hubungan kerja yang baik, BLU/BLUD telah mengidentifikasi, menilai, dan mengelola risiko (termasuk implikasi dari transfer risiko) terkait kemitraan",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - BLU/BLUD  telah memiliki kebijakan pengelolaan risiko terkait kemitraan, penerapannya telah terintegrasi dengan proses bisnis BLU/BLUD , telah direviu secara berkala dan dijadikan bahan pembelajaran",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - BLU/BLUD  telah memiliki kebijakan pengelolaan risiko terkait kemitraan dan penerapannya telah terintegrasi dengan proses bisnis BLU/BLUD",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - BLU/BLUD  telah memiliki kebijakan pengelolaan risiko terkait kemitraan dan telah diterapkan dengan memadai",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - BLU/BLUD  telah memiliki kebijakan pengelolaan risiko terkait kemitraan namun belum diterapkan dengan memadai",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - BLU/BLUD  telah memiliki kebijakan pengelolaan risiko terkait kemitraan namun belum diterapkan sama sekali",
      score: 1,
    },
  ],
},
  ],

  "sub-kapabilitas-5": [
    {
  id: 17,
  label: "Risiko telah teridentifikasi dan  dituangkan dalam register risiko",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Kualitas identifikasi risiko dan register risiko memadai, serta telah mengidentifikasi peluang",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Kualitas identifikasi risiko dan register risiko memadai",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Kualitas identifikasi risiko dan register risiko cukup memadai",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Kualitas identifikasi risiko dan register risiko belum memadai",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Register risiko telah disusun",
      score: 1,
    },
  ],
},
    {
  id: 18,
  label: "Proses manajemen risiko telah melekat pada proses bisnis BLU/BLUD",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Proses manajemen risiko mendukung inovasi, diidentifikasi untuk memaksimalkan peluang dan dijadikan bahan pembelajaran",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Proses manajemen risiko telah diterapkan secara konsisten, terintegrasi dengan proses bisnis dan proses perencanaan tingkat operasional unit kerja dan strategis BLU/BLUD",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Proses manajemen risiko telah diterapkan secara konsisten, terintegrasi dengan proses bisnis dan proses perencanaan tingkat operasional unit kerja",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Proses manajemen risiko telah terintegrasi dengan dengan proses bisnis dan proses perencanaan tingkat operasional unit kerja serta telah diterapkan secara konsisten",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Proses manajemen risiko mulai dihubungkan dengan dengan proses bisnis dan proses perencanaan tingkat operasional unit kerja namun belum diterapkan secara konsisten",
      score: 1,
    },
  ],
},
{
  id: 19,
  label: "Seluruh risiko telah dianalisis dampak dan tingkat keterjadiannya",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Analisis risiko telah dilakukan secara memadai terhadap seluruh risiko tingkat unit kerja dan seluruh risiko strategis BLU/BLUD",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Analisis risiko telah dilakukan secara memadai terhadap seluruh risiko tingkat unit kerja dan sebagian risiko strategis BLU/BLUD",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Analisis risiko telah dilakukan secara memadai terhadap risiko operasional unit kerja",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Analisis risiko telah dilakukan terhadap seluruh risiko tingkat unit kerja yang teridentifikasi namun belum memadai",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Analisis risiko telah dilakukan terhadap sebagian risiko tingkat unit kerja yang teridentifikasi atau sama sekali belum dilakukan",
      score: 1,
    },
  ],
},
{
  id: 20,
  label: "BLU/BLUD telah menentukan prioritas risiko",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - BLU/BLUD  telah menentukan prioritas risiko pada seluruh risiko tingkat unit kerja dan strategis BLU/BLUD",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - BLU/BLUD  telah menentukan prioritas risiko pada seluruh risiko tingkat unit kerja dan sebagian risiko strategis BLU/BLUD ",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - BLU/BLUD  telah menentukan prioritas risiko pada seluruh risiko tingkat unit kerja",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - BLU/BLUD  telah menentukan prioritas risiko pada seluruh risiko tingkat unit kerja",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - BLU/BLUD  telah menentukan prioritas risiko pada sebagian risiko tingkat unit kerja atau belum ditentukan",
      score: 1,
    },
  ],
},
{
  id: 21,
  label: "BLU/BLUD telah menentukan rencana tindak pengendalian",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - BLU/BLUD  telah menentukan rencana tindak pengendalian terhadap risiko operasional unit kerja dan strategis BLU/BLUD  secara memadai",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - BLU/BLUD  telah menentukan rencana tindak pengendalian terhadap risiko operasional unit kerja dan strategis BLU/BLUD  secara memadai",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - BLU/BLUD  telah menentukan rencana tindak pengendalian terhadap seluruh risiko operasional unit kerja dan sebagian risiko  yang telah diprioritaskan",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - BLU/BLUD  telah menentukan rencana tindak pengendalian terhadap seluruh risiko operasional unit kerja yang telah diprioritaskan",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - BLU/BLUD  telah menentukan rencana tindak pengendalian terhadap sebagian risiko operasional unit kerja yang telah diprioritaskan atau belum ditentukan",
      score: 1,
    },
  ],
},
{
  id: 22,
  label: "Strategi dan kebijakan manajemen risiko telah dikomunikasikan.",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Strategi dan kebijakan manajemen risiko telah dikomunikasikan kepada pegawai secara memadai dan telah dipahami seluruh pegawai.",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Strategi dan kebijakan manajemen risiko telah dikomunikasikan kepada pegawai secara memadai dan telah dipahami sebagian besar pegawai.",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Strategi dan kebijakan manajemen risiko telah dikomunikasikan kepada pegawai secara memadai dan telah dipahami sebagian pegawai.",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Strategi dan kebijakan manajemen risiko belum dikomunikasikan pada pegawai secara memadai",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Strategi dan kebijakan manajemen risiko belum dikomunikasikan pada pegawai.",
      score: 1,
    },
  ],
},
{
  id: 23,
  label: "Register risiko dan rencana tindak pengendalian telah dikomunikasikan ke pihak terkait",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Register Risiko dan Rencana Tindak Pengendalian telah dikomunikasikan kepada pegawai, pimpinan, SPI, dan Dewas, serta dijadikan bahan pengambilan keputusan.",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Register Risiko dan Rencana Tindak Pengendalian telah dikomunikasikan kepada pegawai, pimpinan, dan SPI, serta dijadikan bahan pengambilan keputusan.",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Register Risiko dan Rencana Tindak Pengendalian telah dikomunikasikan kepada pegawai dan pimpinan.",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Register Risiko dan Rencana Tindak Pengendalian telah dikomunikasikan kepada pegawai.",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Register Risiko dan Rencana Tindak Pengendalian belum dikomunikasikan.",
      score: 1,
    },
  ],
},
{
  id: 24,
  label: "Proses manajemen risiko telah direviu secara internal",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Reviu proses manajemen risiko secara internal sangat memadai.",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Reviu proses manajemen risiko secara internal telah memadai.",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Reviu proses manajemen risiko secara internal cukup memadai.",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Reviu proses manajemen risiko secara internal kurang memadai.",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Reviu proses manajemen risiko secara internal belum memadai atau belum dilakukan reviu.",
      score: 1,
    },
  ],
},
{
  id: 25,
  label: "Pemantauan/monitoring terhadap risiko telah dilakukan ",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Monitoring terhadap risiko dan tindak pengendalian dilakukan terhadap risiko operasional unit kerja dan risiko strategis BLU/BLUD  secara sangat memadai dan menjadi bahan pembelajaran bagi unit kerja",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Monitoring terhadap risiko dan tindak pengendalian dilakukan terhadap risiko operasional Unit Kerja BLU/BLUD dan risiko strategis BLU/BLUD  secara memadai",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Monitoring terhadap risiko dan tindak pengendalian dilakukan terhadap risiko operasional Unit Kerja BLU/BLUD secara cukup memadai",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Monitoring terhadap risiko dan tindak pengendalian dilakukan terhadap risiko operasional Unit Kerja BLU/BLUD kurang memadai",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Monitoring terhadap risiko dan tindak pengendalian dilakukan terhadap risiko operasional Unit Kerja BLU/BLUD  namun belum memadai atau belum dilakukan",
      score: 1,
    },
  ],
},
{
  id: 26,
  label: "Terdapat reviu independen terhadap proses manajemen risiko",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Reviu proses manajemen risiko secara independen oleh pihak eksternal sangat memadai.",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Reviu proses manajemen risiko secara independen oleh pihak eksternal telah memadai.",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Reviu proses manajemen risiko secara independen oleh pihak eksternal cukup memadai.",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Reviu proses manajemen risiko secara independen oleh pihak eksternal kurang memadai.",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Reviu proses manajemen risiko secara independen oleh pihak eksternal belum memadai atau belum dilakukan reviu.",
      score: 1,
    },
  ],
},
  ],

  "sub-hasil-1": [
    {
  id: 27,
  label: "Adanya Implementasi Tindak Pengendalian",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Tindak pengendalian terhadap seluruh risiko operasional unit kerja dan seluruh risiko strategis BLU/BLUD  telah diimplementasikan",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Tindak pengendalian terhadap seluruh risiko operasional unit kerja dan sebagian risiko strategis BLU/BLUD  telah diimplementasikan",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Tindak pengendalian terhadap sebagian risiko operasional unit kerja telah diimplementasikan",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Tindak pengendalian terhadap sebagian risiko operasional unit kerja telah diimplementasikan",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Tindak pengendalian terhadap sebagian risiko operasional unit kerja telah diimplementasikan  atau belum diimplementasikan",
      score: 1,
    },
  ],
},
  ],

  "sub-hasil-2": [
    {
  id: 28,
  label: "Adanya Efektifitas penurunan risiko",
  criteria: [
    {
      code: "L5",
      label: "Level 5 - Tindak pengendalian telah efektif menurunkan risiko operasional unit kerja, strategis unit kerja, dan strategis BLU/BLUD ",
      score: 5,
    },
    {
      code: "L4",
      label: "Level 4 - Tindak pengendalian telah efektif menurunkan risiko operasional unit kerja dan strategis unit kerja",
      score: 4,
    },
    {
      code: "L3",
      label: "Level 3 - Tindak pengendalian efektif menurunkan seluruh risiko operasional unit kerja dan sebagian risiko strategis unit kerja",
      score: 3,
    },
    {
      code: "L2",
      label: "Level 2 - Tindak pengendalian efektif menurunkan seluruh risiko operasional unit kerja",
      score: 2,
    },
    {
      code: "L1",
      label: "Level 1 - Tindak pengendalian efektif menurunkan sebagian risiko operasional unit kerja atau tidak sama sekali",
      score: 1,
    },
  ],
},
  ],
};
